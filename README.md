# QISTAS: Intelligent Legal Assistant for Saudi Labor Law

## Quick start

```bash
cd ~/projects/qistas
./dev.sh
```
Then open **http://localhost:3000** in your browser (Windows browsers work too).
`Ctrl+C` in the terminal stops everything. API docs: http://127.0.0.1:8000/docs

Arabic web application that analyzes Saudi labor-law cases using Retrieval-Augmented
Generation (RAG) over the official Labor Law, its Implementing Regulations and annexes.

## Project layout

```
qistas/
├── .env                     database URL + API keys (NOT committed)
├── backend/                 Python (FastAPI) backend
│   ├── app/
│   │   ├── config.py        loads .env
│   │   ├── db.py            database connection
│   │   ├── models.py        tables: legal_sources, legal_provisions, provision_chunks
│   │   └── chunking.py      splits long articles into searchable chunks
│   ├── migrations/          Alembic database migrations (schema history)
│   └── scripts/load_kb.py   loads the knowledge base into PostgreSQL
└── data/
    ├── kb/                  knowledge base (committed)
    │   ├── QISTAS_Legal_Knowledge_Base_RAG.jsonl   456 provisions
    │   ├── sources.json                            metadata per legal document
    │   └── status_notes.json                       repealed / merged articles (verified)
    └── raw/                 original official PDFs (not committed, see below)
```

## Requirements

| Tool | Version | Install |
|---|---|---|
| uv | 0.12+ | manages Python + libraries: https://docs.astral.sh/uv/ |
| Python | 3.12 | `uv python install 3.12` |
| PostgreSQL | 18 + pgvector 0.8 | Fedora: `sudo dnf install postgresql-server postgresql-contrib pgvector` |
| Node.js | 22 | for the frontend (`cd frontend && npm install`) |

## Database access

| | |
|---|---|
| Host / Port | `127.0.0.1` / `5432` |
| Database / User | `qistas` / `qistas` |
| Password | see `DATABASE_URL` in `.env` |

- Terminal: `psql -h 127.0.0.1 -U qistas -d qistas`
- Admin (superuser): `sudo -u postgres psql`
- GUI: DBeaver or the VS Code "PostgreSQL" extension, same details as above.
- Service: `sudo systemctl status|start|stop postgresql` (starts automatically).

## Setting up from scratch (e.g. a teammate's machine)

```bash
# 1. database
sudo -u postgres psql -c "CREATE ROLE qistas LOGIN PASSWORD 'choose-a-password';"
sudo -u postgres psql -c "CREATE DATABASE qistas OWNER qistas;"
sudo -u postgres psql -d qistas -c "CREATE EXTENSION vector;"

# 2. .env in the project root
echo "DATABASE_URL=postgresql://qistas:choose-a-password@127.0.0.1:5432/qistas" > .env
echo "GEMINI_API_KEY=" >> .env

# 3. backend
cd backend
uv sync                              # installs Python 3.12 + libraries
uv run alembic upgrade head          # creates the tables
uv run python -m scripts.load_kb     # loads the knowledge base (safe to re-run)
uv run python -m scripts.embed_kb    # Gemini embeddings for new chunks (~5 min first time, resumable)
```

## Search

```bash
cd backend
uv run python -m scripts.search_cli "فصلوني بدون سبب، كم التعويض؟"      # try a question
uv run python -m scripts.search_cli "..." --mode vector|keyword -k 10
uv run python -m scripts.eval_retrieval --show-misses                  # accuracy on data/eval
```
Default search = Gemini semantic search + direct lookup of article numbers ("المادة 77").

## Case analysis API

```bash
cd backend
uv run uvicorn app.api:app --reload        # start the API on http://127.0.0.1:8000
# open http://127.0.0.1:8000/docs to try every endpoint in the browser
uv run python -m scripts.analyze_cli "وصف الحالة..." --employee "الاسم"   # same pipeline from the terminal
uv run pytest                               # unit tests (masking, grounding); no API calls
```

| Endpoint | Purpose |
|---|---|
| `POST /api/cases/analyze` | analyze a case → facts, issues, cited articles, analysis, missing info, expected outcome, next steps |
| `GET /api/cases/{id}` | a saved analysis (masked) |
| `GET /api/search?q=` | search the law |
| `GET /api/provisions/{record_id}` | full text of one article |
| `GET /api/kb/info` | sources and "up to date as of" date |

Pipeline: mask personal data (`app/privacy.py`) → search (`app/search.py`) → add companion articles
and implementing regulations (`app/expansion.py`, rules in `data/kb/companions.json`) → Gemini with a
strict prompt and JSON schema (`app/prompts.py`, `app/analysis.py`) → drop any citation that wasn't
retrieved → save masked case → restore names in the response only.

Chat model: `GEMINI_CHAT_MODEL` (default `gemini-flash-latest`) with automatic fallback to
`GEMINI_FALLBACK_MODELS` when Google reports overload. Both are optional settings in `.env`.

## Knowledge base

- **Scope (v1):** Saudi Labor Law (all 245 articles + 4 "مكرر" articles), its
  Implementing Regulations (ministerial decision 115921, 1446/08/19هـ) and annexes 1–5.
- **Up to date as of:** 2026-10-03 (stored per source in `legal_sources.collected_on`).
- **Repealed / merged articles:** 38 Labor Law articles and 3 regulations articles are
  absent from the source file because they were repealed or merged. Each was verified
  against the official text and is stored as a short record stating its status and the
  royal decree responsible (see `data/kb/status_notes.json`).
- **Priority:** Labor Law, Regulations and Annex 1 are `core`; Annexes 2–5
  (disability accommodations, recruitment intermediaries, recruitment companies,
  contract templates) are `secondary`.

### Official sources
- Labor Law (Bureau of Experts): https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/08381293-6388-48e2-8ad2-a9a700f2aa94/1
- Implementing Regulations and annexes (HRSD): https://www.hrsd.gov.sa/ar/knowledge-centre/decisions-and-regulations/regulation-and-procedures/838894
- Violations and Penalties Table, ministerial decision 112377 (Feb 2026, HRSD):
  https://www.hrsd.gov.sa/sites/default/files/2026-02/qrar-wzary---112377.pdf
  (scanned PDF; not yet in the knowledge base)

`data/raw/` holds downloaded copies of these PDFs. It is git-ignored because of size
(the violations table alone is 35 MB); re-download from the links above.

## Website (frontend/)

Next.js 16 + TypeScript + Tailwind, Arabic RTL. Pages: case analysis (`/`), law search
(`/search`), article (`/articles/[id]`). The API address can be changed with
`NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000`). The UI is deliberately plain and
structured for a later redesign; see `frontend/DESIGN.md`.
