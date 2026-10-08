"""Terminal scripts save their cases under a dedicated, login-disabled account named "cli"."""
import secrets

from sqlalchemy import select

from app.analysis import case_view, create_case
from app.auth import hash_password
from app.db import SessionLocal
from app.models import Case, User
from app.schemas import AnalyzeRequest, AnalyzeResponse


def cli_user() -> User:
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.username == "cli"))
        if user is None:
            user = User(
                username="cli", email="cli@localhost", role="user", is_active=False,  # cannot log in
                password_hash=hash_password(secrets.token_urlsafe(24)),
            )
            db.add(user)
            db.flush()
        return user


def analyze_case(req: AnalyzeRequest) -> AnalyzeResponse:
    case_id = create_case(cli_user(), req)
    with SessionLocal() as db:
        return case_view(db, db.get(Case, case_id))
