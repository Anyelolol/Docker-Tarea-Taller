# PlagiDec — Módulo de Detección de Plagio e IA para Moodle

> Proyecto de Título · Universidad del Bío-Bío · ADPT / UGCM  
> Entrega: Integración con Docker Compose · Fullstack 2026

---

## Descripción

PlagiDec es un sistema de detección de plagio y contenido generado por IA, diseñado para integrarse como plugin en la plataforma Moodle de la UBB. Esta entrega corresponde al prototipo orquestado con Docker Compose.

### Arquitectura de servicios

```
Profesor
   │
   ▼
Frontend (Node · :3000)     ← interfaz prototipo
   │  (en producción: plugin PHP dentro de Moodle)
   ▼
Backend-Arc (PHP · :8081)   ← recibe archivos, guarda en BD, coordina
   │                  │
   ▼                  ▼
Backend-IA         PostgreSQL
(Python · :8000)   (:5432 · interno)
shingling + IA
   │
   └──── resultados ──► Backend-Arc ──► Frontend
```

**Nota importante:** el servicio `frontend` (puerto 3000) es una interfaz de prototipo que simula el plugin de Moodle. En producción, esta interfaz se integrará como plugin PHP directamente dentro de Moodle (puerto 8080). Moodle está disponible y funcional en `http://localhost:8080`, pero en esta etapa no tiene el plugin instalado aún.

### Servicios

| Servicio | Tecnología | Puerto | Función |
|---|---|---|---|
| `frontend` | Node 20 + React + Vite | 3000 | UI prototipo del plugin |
| `moodle` | erseco/alpine-moodle | 8080 | Plataforma Moodle completa |
| `backend-arc` | PHP 8.2 + Apache | 8081 | Orquestador: recibe archivos, guarda rutas/logs/resultados en BD, llama al backend-ia |
| `backend-ia` | Python 3.11 + FastAPI | 8000 | Motor de análisis: shingling (plagio) + heurística IA |
| `postgres` | PostgreSQL 15 | interno | Almacena rutas, logs y resultados |

---

## Despliegue

### Requisitos

- Docker Desktop (o Docker Engine + Docker Compose plugin)
- Puertos disponibles: 3000, 8080, 8081, 8000

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/usuario/plagidec.git

# 2. Ingresar al directorio
cd plagidec

# 3. (Opcional) Copiar y ajustar variables de entorno
cp .env.example .env

# 4. Levantar todos los servicios
docker compose up
```

### Acceso a los servicios

| URL | Servicio |
|---|---|
| http://localhost:3000 | Frontend prototipo PlagiDec ✓ |
| http://localhost:8080 | Moodle completo |
| http://localhost:8081 | Backend-Arc (API PHP) |
| http://localhost:8000/docs | Backend-IA (Swagger FastAPI) |

---

## Uso del prototipo

1. Abre `http://localhost:3000`
2. Arrastra o selecciona un archivo de texto (.txt, .pdf, .docx, etc.)
3. Haz clic en **Analizar documento**
4. El frontend envía el archivo al `backend-arc`, que lo almacena y lo reenvía al `backend-ia`
5. Se muestran los resultados: porcentaje de similitud (plagio) y probabilidad de IA

### Endpoints del Backend-Arc

```
GET  http://localhost:8081/           → health check
POST http://localhost:8081/analyze    → analizar documento (multipart/form-data, campo: document)
GET  http://localhost:8081/results    → listar resultados guardados
```

### Endpoints del Backend-IA

```
GET  http://localhost:8000/           → health check
POST http://localhost:8000/analyze    → analizar texto (JSON: {"text": "..."})
GET  http://localhost:8000/docs       → documentación Swagger
```

---

## Variables de entorno

Ver `.env.example`. Los valores por defecto permiten levantar el proyecto sin crear un `.env`:

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `POSTGRES_USER` | `admin` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | `secreto123` | Contraseña de PostgreSQL |
| `POSTGRES_DB` | `moodle_db` | Nombre de la base de datos |
| `MOODLE_USERNAME` | `admin` | Usuario administrador de Moodle |
| `MOODLE_PASSWORD` | `Admin1234!` | Contraseña de Moodle |

---

## Estructura del repositorio

```
plagidec/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend-arc/
│   ├── Dockerfile
│   └── src/
│       └── index.php
├── backend-ia/
│   ├── Dockerfile
│   └── src/
│       ├── main.py
│       └── requirements.txt
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── index.html
│       ├── main.jsx
│       ├── package.json
│       └── vite.config.js
├── moodle/
│   └── Dockerfile
└── postgres/
    └── Dockerfile
```

---

## Notas técnicas

- Los contenedores se comunican por **nombre de servicio** como hostname (ej: `http://backend-ia:8000`), no por `localhost`.
- PostgreSQL **no expone puerto al host** por seguridad — solo los servicios internos lo acceden.
- El `backend-arc` espera a que PostgreSQL esté listo (`healthcheck` con `pg_isready`) antes de iniciar.
- El análisis de IA en esta versión usa shingling (Jaccard) para plagio y heurística lingüística para detección de IA. En versiones futuras se integrará Sentence-BERT y RoBERTa fine-tuned.
