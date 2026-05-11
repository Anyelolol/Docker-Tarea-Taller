from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re, math, os
from collections import Counter

app = FastAPI(title="PlagiDec — Backend IA", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SHARED_UPLOAD_DIR = os.getenv("SHARED_UPLOAD_DIR", "/var/plagidec/uploads")


# ---------------------------------------------------------------------------
# Modelos de entrada
# ---------------------------------------------------------------------------

class FileInput(BaseModel):
    filepath: str
    submission_id: int


# ---------------------------------------------------------------------------
# Utilidades de texto
# ---------------------------------------------------------------------------

def read_file(filepath: str) -> str:
    """Lee el archivo desde el volumen compartido y retorna su contenido como texto."""
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado en el volumen compartido: {filepath}")

    # Seguridad: el archivo debe estar dentro del directorio compartido permitido
    real_path = os.path.realpath(filepath)
    allowed   = os.path.realpath(SHARED_UPLOAD_DIR)
    if not real_path.startswith(allowed):
        raise HTTPException(status_code=403, detail="Acceso denegado: ruta fuera del directorio compartido.")

    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo archivo: {str(e)}")


def tokenize(text: str) -> list[str]:
    """Tokeniza el texto en palabras limpias (minúsculas, sin puntuación)."""
    return re.findall(r'\w+', text.lower())


def shingling(text: str, k: int = 5) -> set:
    """Genera k-shingles (n-gramas de palabras) del texto."""
    words = tokenize(text)
    return {" ".join(words[i:i+k]) for i in range(len(words) - k + 1)}


def jaccard_similarity(set_a: set, set_b: set) -> float:
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def extract_keywords(text: str, top_n: int = 10) -> list[str]:
    """Extrae las palabras clave más frecuentes (excluye stopwords básicas)."""
    stopwords = {
        "de", "la", "el", "en", "y", "a", "que", "los", "las", "un", "una",
        "es", "se", "del", "al", "por", "con", "su", "para", "como", "más",
        "pero", "sus", "le", "ya", "o", "fue", "lo", "si", "sobre", "este",
        "entre", "cuando", "también", "me", "sin", "sobre", "este", "ser",
        "tiene", "son", "han", "está", "the", "of", "and", "to", "in", "is",
        "that", "for", "on", "are", "with", "as", "at", "be", "this",
    }
    words = tokenize(text)
    filtered = [w for w in words if len(w) > 3 and w not in stopwords]
    counter = Counter(filtered)
    return [word for word, _ in counter.most_common(top_n)]


def estimate_ai_score(text: str) -> float:
    """
    Heurística de demostración.
    En producción: reemplazar con modelo RoBERTa fine-tuned (HC3 dataset).
    Detecta patrones asociados a texto generado por IA: alta uniformidad de
    longitud de oraciones, vocabulario formal repetitivo, ausencia de errores.
    """
    sentences = [s.strip() for s in re.split(r'[.!?]', text) if len(s.strip()) > 10]
    if len(sentences) < 2:
        return 0.0

    lengths = [len(s.split()) for s in sentences]
    avg = sum(lengths) / len(lengths)
    variance = sum((l - avg) ** 2 for l in lengths) / len(lengths)
    std_dev = math.sqrt(variance)

    uniformity_score = max(0.0, 1.0 - (std_dev / (avg + 1)))

    ai_markers = [
        "en conclusión", "en resumen", "es importante destacar",
        "cabe mencionar", "por otro lado", "sin embargo", "además",
        "asimismo", "en este sentido", "se puede observar",
    ]
    text_lower = text.lower()
    marker_hits = sum(1 for m in ai_markers if m in text_lower)
    marker_score = min(1.0, marker_hits / 3)

    score = (uniformity_score * 0.6 + marker_score * 0.4) * 100
    return round(score, 2)


# ---------------------------------------------------------------------------
# Corpus interno en memoria (en producción: persistir en BD)
# ---------------------------------------------------------------------------

_internal_corpus: list[dict] = []   # [{submission_id, shingles}]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def health():
    return {"status": "ok", "service": "backend-ia", "corpus_size": len(_internal_corpus)}


@app.post("/analyze-file")
def analyze_file(body: FileInput):
    """
    Recibe la ruta de un archivo guardado en el volumen compartido,
    lo lee directamente, lo tokeniza, calcula plagio y score IA,
    y retorna porcentaje + palabras clave al backend-arc.
    """
    # 1. Leer el archivo desde el volumen compartido
    text = read_file(body.filepath)
    text = text.strip()

    if not text:
        return {
            "plagiarism_score": 0.0,
            "ai_score": 0.0,
            "keywords": [],
            "suspicious_fragments": [],
            "word_count": 0,
            "shingle_count": 0,
            "corpus_size": len(_internal_corpus),
            "message": "Archivo vacío o sin texto extraíble.",
        }

    # 2. Tokenización y shingling
    doc_shingles = shingling(text)

    # 3. Comparar contra corpus interno para detección de plagio
    max_similarity = 0.0
    if _internal_corpus:
        similarities = [
            jaccard_similarity(doc_shingles, entry["shingles"])
            for entry in _internal_corpus
        ]
        max_similarity = max(similarities) * 100

    # 4. Guardar en corpus (evitar duplicar misma submission)
    already_in = any(e["submission_id"] == body.submission_id for e in _internal_corpus)
    if not already_in:
        _internal_corpus.append({
            "submission_id": body.submission_id,
            "shingles": doc_shingles,
        })
    if len(_internal_corpus) > 500:
        _internal_corpus.pop(0)

    # 5. Score IA
    ai_score = estimate_ai_score(text)

    # 6. Palabras clave
    keywords = extract_keywords(text, top_n=10)

    # 7. Fragmentos sospechosos
    sentences = [s.strip() for s in re.split(r'[.!?]', text) if len(s.strip()) > 20]
    ai_markers = [
        "en conclusión", "es importante destacar", "cabe mencionar",
        "por otro lado", "sin embargo", "en este sentido",
    ]
    suspicious = [
        s[:120] for s in sentences[:10]
        if any(m in s.lower() for m in ai_markers)
    ]

    return {
        "plagiarism_score":    round(max_similarity, 2),
        "ai_score":            ai_score,
        "keywords":            keywords,
        "suspicious_fragments": suspicious[:5],
        "word_count":          len(text.split()),
        "shingle_count":       len(doc_shingles),
        "corpus_size":         len(_internal_corpus),
    }
