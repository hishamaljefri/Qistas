"""Passwords, login tokens and role checks.

- Passwords are hashed with bcrypt (CS498 SR1); the plain password is never stored.
- After login the client gets a JWT valid for TOKEN_MINUTES (30). The client calls
  /api/auth/refresh while the user is active, so a session ends after 30 minutes of
  inactivity (SR2).
- current_user / require_admin are FastAPI dependencies that protect routes (SR4).
"""
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import JWT_SECRET, TOKEN_MINUTES
from app.db import get_db
from app.models import User

ALGORITHM = "HS256"
_bearer = HTTPBearer(auto_error=False)
# Compared against when the username doesn't exist, so a wrong username and a wrong
# password take the same time (doesn't reveal which accounts exist).
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    return bcrypt.checkpw(password.encode(), (password_hash or _DUMMY_HASH).encode()) and password_hash is not None


def create_token(user: User) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(user.id), "role": user.role, "iat": now, "exp": now + timedelta(minutes=TOKEN_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, message, headers={"WWW-Authenticate": "Bearer"})


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized("يجب تسجيل الدخول أولاً")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise _unauthorized("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى") from None
    except jwt.InvalidTokenError:
        raise _unauthorized("جلسة غير صالحة، يرجى تسجيل الدخول") from None
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise _unauthorized("الحساب غير موجود أو موقوف")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "هذه العملية متاحة للمشرف فقط")
    return user
