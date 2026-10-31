"""Settings loaded from the project-level .env file."""
import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"

load_dotenv(PROJECT_ROOT / ".env")

# Local Postgres or Neon (hosted); both URL spellings are accepted.
DATABASE_URL = (
    os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://", 1).replace("postgres://", "postgresql+psycopg://", 1)
)
# Websites allowed to call the API from the browser (comma-separated). On the server this is the
# deployed website's address, e.g. https://qistas.vercel.app; locally it is the Next.js dev server.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Alias that tracks Google's current Flash model; the concrete version used is
# saved with every analysis (case_analyses.model_version).
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-flash-latest")
# Tried in order when the main model stays overloaded (503) or rate-limited (429).
GEMINI_FALLBACK_MODELS = [
    m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash,gemini-flash-lite-latest").split(",") if m.strip()
]

# Login tokens (JWT). A token is valid for TOKEN_MINUTES; the client refreshes it while the
# user is active, so a session ends after 30 minutes of inactivity (CS498 SR2).
JWT_SECRET = os.environ["JWT_SECRET"]
TOKEN_MINUTES = int(os.getenv("TOKEN_MINUTES", "30"))
# Fernet key that encrypts the real names/IDs behind the placeholders (CS498 SR9).
ENCRYPTION_KEY = os.environ["ENCRYPTION_KEY"]

# Size of the embedding vectors stored in provision_chunks.embedding.
# Gemini embeddings are requested with output_dimensionality=768.
EMBEDDING_DIM = 768
