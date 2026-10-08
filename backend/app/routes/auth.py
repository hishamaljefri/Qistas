"""Accounts: register, login, refresh, current user (FR1, FR2)."""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import create_token, current_user, hash_password, verify_password
from app.config import TOKEN_MINUTES
from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_token(user),
        expires_in=TOKEN_MINUTES * 60,
        user=UserOut.model_validate(user, from_attributes=True),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    username, email = req.username.lower(), req.email.strip().lower()
    taken = db.scalar(select(User).where(or_(User.username == username, User.email == email)))
    if taken is not None:
        field = "اسم المستخدم" if taken.username == username else "البريد الإلكتروني"
        raise HTTPException(status.HTTP_409_CONFLICT, f"{field} مستخدم مسبقاً")
    user = User(username=username, email=email, password_hash=hash_password(req.password), role="user", is_active=True)
    user.last_login_at = datetime.now(UTC)
    db.add(user)
    db.commit()
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    identifier = req.identifier.strip().lower()
    user = db.scalar(select(User).where(or_(User.username == identifier, func.lower(User.email) == identifier)))
    if not verify_password(req.password, user.password_hash if user else None):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "اسم المستخدم أو كلمة المرور غير صحيحة")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "هذا الحساب موقوف، تواصل مع المشرف")
    user.last_login_at = datetime.now(UTC)
    db.commit()
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(user: User = Depends(current_user)) -> TokenResponse:
    """Issue a fresh 30-minute token. Called by the client while the user is active."""
    return _token_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.model_validate(user, from_attributes=True)
