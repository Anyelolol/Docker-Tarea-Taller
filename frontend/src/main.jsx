import { useState, useRef } from "react"
import { createRoot } from "react-dom/client"

const API = import.meta.env.VITE_API_URL || "http://localhost:8081"

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'IBM Plex Sans', sans-serif;
    background: #0f1117;
    color: #e2e8f0;
    min-height: 100vh;
  }

  .shell {
    max-width: 820px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }

  .header {
    border-bottom: 1px solid #1e2535;
    padding-bottom: 24px;
    margin-bottom: 40px;
  }

  .logo {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    color: #4ade80;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .title {
    font-size: 28px;
    font-weight: 600;
    color: #f1f5f9;
    line-height: 1.2;
  }

  .subtitle {
    font-size: 14px;
    color: #64748b;
    margin-top: 6px;
  }

  .card {
    background: #161b27;
    border: 1px solid #1e2535;
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 20px;
  }

  .card-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #4ade80;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .drop-zone {
    border: 1.5px dashed #2d3748;
    border-radius: 8px;
    padding: 40px 24px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    background: #0f1117;
  }

  .drop-zone:hover, .drop-zone.over {
    border-color: #4ade80;
    background: #0f1f13;
  }

  .drop-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .drop-text {
    font-size: 14px;
    color: #94a3b8;
    margin-bottom: 4px;
  }

  .drop-hint {
    font-size: 12px;
    color: #475569;
    font-family: 'IBM Plex Mono', monospace;
  }

  input[type="file"] { display: none; }

  .file-selected {
    background: #0f1f13;
    border: 1px solid #166534;
    border-radius: 8px;
    padding: 12px 16px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    color: #4ade80;
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn {
    width: 100%;
    padding: 14px;
    background: #4ade80;
    color: #0a0f0a;
    border: none;
    border-radius: 8px;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 16px;
    transition: background 0.15s, transform 0.1s;
    letter-spacing: 0.02em;
  }

  .btn:hover:not(:disabled) { background: #86efac; }
  .btn:active:not(:disabled) { transform: scale(0.99); }
  .btn:disabled { background: #1e2535; color: #475569; cursor: not-allowed; }

  .loading {
    text-align: center;
    padding: 32px;
    color: #64748b;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
  }

  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #1e2535;
    border-top-color: #4ade80;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .results-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  .score-block {
    background: #0f1117;
    border: 1px solid #1e2535;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
  }

  .score-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #64748b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .score-value {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 40px;
    font-weight: 500;
    line-height: 1;
  }

  .score-unit {
    font-size: 16px;
    color: #64748b;
    margin-left: 2px;
  }

  .score-bar-wrap {
    height: 6px;
    background: #1e2535;
    border-radius: 3px;
    margin-top: 12px;
    overflow: hidden;
  }

  .score-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.8s ease;
  }

  .green  { color: #4ade80; }
  .yellow { color: #facc15; }
  .red    { color: #f87171; }
  .fill-green  { background: #4ade80; }
  .fill-yellow { background: #facc15; }
  .fill-red    { background: #f87171; }

  .meta-row {
    display: flex;
    justify-content: space-between;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    color: #475569;
    border-top: 1px solid #1e2535;
    padding-top: 12px;
    margin-top: 4px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .fragments-title {
    font-size: 13px;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 10px;
    font-family: 'IBM Plex Mono', monospace;
  }

  .fragment {
    background: #1a1208;
    border-left: 3px solid #facc15;
    border-radius: 0 6px 6px 0;
    padding: 10px 14px;
    font-size: 13px;
    color: #cbd5e1;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .no-fragments {
    font-size: 13px;
    color: #475569;
    font-family: 'IBM Plex Mono', monospace;
  }

  .history-card {
    margin-top: 40px;
  }

  .history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #1e2535;
    font-size: 13px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .history-name {
    font-family: 'IBM Plex Mono', monospace;
    color: #94a3b8;
    font-size: 12px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pill {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 20px;
    font-weight: 500;
  }

  .pill-green  { background: #052e16; color: #4ade80; }
  .pill-yellow { background: #1c1700; color: #facc15; }
  .pill-red    { background: #1f0000; color: #f87171; }

  .error-box {
    background: #1f0000;
    border: 1px solid #7f1d1d;
    border-radius: 8px;
    padding: 16px;
    color: #f87171;
    font-size: 13px;
    margin-top: 12px;
    font-family: 'IBM Plex Mono', monospace;
  }

  .note {
    font-size: 12px;
    color: #334155;
    background: #0f1117;
    border: 1px solid #1e2535;
    border-radius: 8px;
    padding: 12px 16px;
    margin-top: 16px;
    line-height: 1.6;
  }

  .note strong { color: #475569; }
`

function scoreColor(v) {
  if (v < 30) return "green"
  if (v < 60) return "yellow"
  return "red"
}

function scorePill(v) {
  const c = scoreColor(v)
  return `pill pill-${c}`
}

function ScoreBlock({ label, value }) {
  const c = scoreColor(value)
  return (
    <div className="score-block">
      <div className="score-label">{label}</div>
      <div className={`score-value ${c}`}>
        {value.toFixed(1)}<span className="score-unit">%</span>
      </div>
      <div className="score-bar-wrap">
        <div
          className={`score-bar-fill fill-${c}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

function App() {
  const [file, setFile] = useState(null)
  const [over, setOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (f) { setFile(f); setResult(null); setError(null) }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const analyze = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const fd = new FormData()
      fd.append("document", file)
      const res = await fetch(`${API}/analyze`, { method: "POST", body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult(data)
      setHistory(h => [{ ...data, name: file.name, ts: new Date().toLocaleTimeString() }, ...h].slice(0, 10))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="shell">
        <div className="header">
          <div className="logo">UBB · ADPT · PlagiDec v0.1</div>
          <div className="title">Detector de Plagio e IA Generativa</div>
          <div className="subtitle">Prototipo de interfaz — el plugin definitivo se integrará en Moodle (puerto 8080)</div>
        </div>

        <div className="card">
          <div className="card-label">01 — Subir documento</div>
          <div
            className={`drop-zone ${over ? "over" : ""}`}
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={handleDrop}
          >
            <div className="drop-icon">📄</div>
            <div className="drop-text">Arrastra un archivo o haz clic para seleccionar</div>
            <div className="drop-hint">.txt · .pdf · .docx · cualquier formato de texto</div>
          </div>
          <input ref={inputRef} type="file" onChange={e => handleFile(e.target.files[0])} />

          {file && (
            <div className="file-selected">
              <span>✓</span>
              <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}

          <button className="btn" onClick={analyze} disabled={!file || loading}>
            {loading ? "Analizando…" : "Analizar documento"}
          </button>

          {error && <div className="error-box">Error: {error}</div>}

          <div className="note">
            <strong>Nota arquitectónica:</strong> este frontend envía el archivo al <code>backend-arc</code> (PHP · :8081),
            que lo almacena en PostgreSQL y lo reenvía al <code>backend-ia</code> (Python · :8000) para el análisis.
          </div>
        </div>

        {loading && (
          <div className="card loading">
            <div className="spinner" />
            <div>Procesando en backend-ia…</div>
          </div>
        )}

        {result && !loading && (
          <div className="card">
            <div className="card-label">02 — Resultados del análisis</div>
            <div className="results-grid">
              <ScoreBlock label="Similitud / Plagio" value={result.plagiarism_score ?? 0} />
              <ScoreBlock label="Probabilidad de IA" value={result.ai_score ?? 0} />
            </div>

            <div className="meta-row">
              <span>submission_id: {result.submission_id}</span>
              <span>palabras: {result.details?.word_count ?? "—"}</span>
              <span>shingles: {result.details?.shingle_count ?? "—"}</span>
              <span>corpus: {result.details?.corpus_size ?? "—"} docs</span>
            </div>

            {result.details?.suspicious_fragments?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="fragments-title">Fragmentos sospechosos detectados</div>
                {result.details.suspicious_fragments.map((f, i) => (
                  <div key={i} className="fragment">{f}…</div>
                ))}
              </div>
            )}

            {result.details?.suspicious_fragments?.length === 0 && (
              <div style={{ marginTop: 16 }}>
                <span className="no-fragments">✓ Sin fragmentos sospechosos detectados.</span>
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="card history-card">
            <div className="card-label">03 — Historial de esta sesión</div>
            {history.map((h, i) => (
              <div key={i} className="history-row">
                <span className="history-name" title={h.name}>{h.name}</span>
                <span className={scorePill(h.plagiarism_score ?? 0)}>
                  plagio {(h.plagiarism_score ?? 0).toFixed(1)}%
                </span>
                <span className={scorePill(h.ai_score ?? 0)}>
                  IA {(h.ai_score ?? 0).toFixed(1)}%
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#334155" }}>
                  {h.ts}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

createRoot(document.getElementById("root")).render(<App />)
