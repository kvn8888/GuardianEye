# GuardianEye — AI-Powered Scam Detection

GuardianEye protects vulnerable people from scams by analyzing screenshots, voice recordings, and text messages using a multi-agent AI pipeline. Submit any suspicious content and get an instant verdict: **RED** (scam), **YELLOW** (caution), or **GREEN** (safe).

## How It Works

```
User submits screenshot / voice recording / text
  ↓
┌─────────────────────────────────────────────────────┐
│  Pipeline (runs in parallel, streams via SSE)       │
│                                                     │
│  1. Reka Vision — reads text from images            │
│  2. GLiNER — extracts entities (phones, URLs, $$$)  │
│  3. Tavily — searches scam databases (fast, ~2s)    │
│  4. Yutori Research — deep investigation (~60s)     │
│  5. Verdict Engine — synthesizes all signals         │
│  6. Neo4j — maps scam network (entities → reports)  │
└─────────────────────────────────────────────────────┘
  ↓
Verdict: RED / YELLOW / GREEN + confidence + findings
```

The verdict engine uses **OpenAI GPT-4o-mini** when an API key is provided, or a **rule-based scoring system** as the default fallback. The rule-based engine scores entity patterns (threat language, deadlines, suspicious URLs) from all upstream signals.

## Quick Start

### Backend (Python / FastAPI)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # fill in API keys
python main.py               # http://localhost:8000
```

### Frontend (React / Vite / TypeScript)

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api → :8000)
```

In production, the backend serves the built frontend — no separate server needed:

```bash
cd frontend && npm run build   # creates dist/
cd ../backend && python main.py  # serves API + frontend on :8000
```

## API Keys

| Service | Env Var | Purpose | Get it at |
|---------|---------|---------|-----------|
| OpenAI *(optional)* | `OPENAI_API_KEY` | Enhanced verdict synthesis (GPT-4o-mini) | platform.openai.com |
| Yutori | `YUTORI_API_KEY` | Deep autonomous research agents | platform.yutori.com |
| Fastino/GLiNER | `FASTINO_API_KEY` | Entity extraction (phones, URLs, companies) | labs.fastino.ai |
| Reka | `REKA_API_KEY` | Vision — read text from screenshots | platform.reka.ai |
| Tavily | `TAVILY_API_KEY` | Fast scam database search | tavily.com |
| Modulate | `MODULATE_API_KEY` | Voice deepfake detection | modulate.ai |
| Neo4j | `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` | Scam network graph | neo4j.com/aura |
| Turso *(optional)* | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Cloud-synced cache | turso.tech |

All services degrade gracefully — the pipeline uses rule-based fallbacks when an API key is missing.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/scan/image` | Upload screenshot (multipart `image` field) |
| `POST` | `/api/scan/voice` | Upload audio (multipart `audio` field) |
| `POST` | `/api/scan/text` | Submit text `{ "text": "..." }` |
| `GET` | `/api/scan/:id/status` | SSE stream of real-time analysis events |
| `GET` | `/api/scan/:id/verdict` | Full verdict + entities for a completed scan |
| `GET` | `/api/scans` | List all scans (persisted across restarts) |
| `GET` | `/api/graph/:scanId` | Neo4j scam network graph for a scan |
| `GET` | `/api/graph/network/:entity` | Network graph for a specific entity |
| `GET` | `/api/threats/recent` | Recent threats from the scam network |
| `POST` | `/api/scout/create` | Deploy a Yutori scouting agent |
| `GET` | `/api/scout/status` | Active scout status |
| `POST` | `/api/alert/family` | Send family alert for a scan |
| `GET` | `/api/cache/stats` | Cache hit/miss statistics |
| `DELETE` | `/api/cache` | Clear all cached results |
| `GET` | `/health` | Health check |

## Architecture

```
GuardianEye/
├── backend/
│   ├── main.py                    # FastAPI app + SPA serving
│   ├── routes/
│   │   ├── scan.py                # Scan submission + SSE + verdicts
│   │   ├── graph.py               # Neo4j graph queries
│   │   └── scout.py               # Yutori scouting + family alerts
│   ├── services/
│   │   ├── reka_service.py        # Reka Vision (image → text)
│   │   ├── gliner_service.py      # GLiNER entity extraction
│   │   ├── tavily_service.py      # Tavily scam database search
│   │   ├── yutori_service.py      # Yutori deep research agents
│   │   ├── openai_service.py      # OpenAI verdict synthesis
│   │   ├── modulate_service.py    # Modulate voice deepfake detection
│   │   ├── neo4j_service.py       # Neo4j graph operations
│   │   └── cache_service.py       # SQLite/Turso result caching
│   └── models/schemas.py          # Pydantic request/response models
├── frontend/
│   ├── src/
│   │   ├── pages/                 # React pages (Index, Analysis, Verdict, etc.)
│   │   ├── api/client.ts          # API client (all fetch calls)
│   │   ├── api/adapters.ts        # Backend → frontend data adapters
│   │   └── components/            # UI components (Shadcn/Radix)
│   └── index.html
├── render.yaml                    # Render deployment config
└── .env.example
```

## Caching

Identical content (same SHA-256 hash) returns cached results instantly:

- **First scan**: Full pipeline runs (~60s) → result + SSE events stored in SQLite
- **Repeat scan**: Cache hit → SSE events replay with animation (~3s) → same verdict

Cache syncs to Turso cloud when `TURSO_DATABASE_URL` is set, so results persist across deploys.

## Scan Persistence

Completed scans are saved to SQLite/Turso and survive server restarts. The `/api/scans` endpoint merges in-memory (in-progress) and persisted (completed) scans.

## Deployment (Render)

The `render.yaml` defines a single web service that builds both frontend and backend:

```bash
# Build: npm install + npm run build (frontend) → pip install (backend)
# Start: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Set all env vars in the Render dashboard. The backend serves the built frontend at `/` and the API at `/api/*`.

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, Uvicorn
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **AI**: Yutori Research, Fastino/GLiNER, Reka Vision, Modulate, OpenAI (optional)
- **Search**: Tavily
- **Graph**: Neo4j Aura
- **Cache**: SQLite + Turso (optional cloud sync)
- **Hosting**: Render
