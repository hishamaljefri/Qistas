# QISTAS backend image (used by Render, see render.yaml). Build from the repository root:
#   docker build -f backend/Dockerfile .
FROM python:3.12-slim-bookworm

# WeasyPrint (PDF report and claim) needs Pango and HarfBuzz; the Arabic font is bundled in backend/assets/fonts.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fontconfig \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.12.22 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never PYTHONUNBUFFERED=1

WORKDIR /app/backend
# dependencies first, so a code change does not reinstall them
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/ ./
# the only data file read at run time (query expansion); the knowledge base itself is in the database
COPY data/kb/companions.json /app/data/kb/companions.json
ENV PATH="/app/backend/.venv/bin:$PATH"

# apply any new database migrations, then serve on the port Render assigns ($PORT)
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.api:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
