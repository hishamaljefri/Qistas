"""Settings loaded from the project-level .env file."""
import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"

load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://", 1)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Alias that tracks Google's current Flash model; the concrete version used is
# saved with every analysis (case_analyses.model_version).
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-flash-latest")
# Tried in order when the main model stays overloaded (503) or rate-limited (429).
GEMINI_FALLBACK_MODELS = [
    m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash,gemini-flash-lite-latest").split(",") if m.strip()
]

# Size of the embedding vectors stored in provision_chunks.embedding.
# Gemini embeddings are requested with output_dimensionality=768.
EMBEDDING_DIM = 768
