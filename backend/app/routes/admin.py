"""Administration: manage user accounts and roles (FR14). Admin role only (SR4)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.db import get_db
from app.models import Case, User
from app.schemas import AdminUserUpdate, UserOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminUserOut(UserOut):
    case_count: int


@router.get("/users", response_model=list[AdminUserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[AdminUserOut]:
    counts = dict(db.execute(select(Case.user_id, func.count(Case.id)).group_by(Case.user_id)).all())
    users = db.scalars(select(User).order_by(User.id)).all()
    return [
        AdminUserOut(**UserOut.model_validate(u, from_attributes=True).model_dump(), case_count=counts.get(u.id, 0))
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, req: AdminUserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> UserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "المستخدم غير موجود")
    if user.id == admin.id and (req.role == "user" or req.is_active is False):
        # prevents the last admin from locking everyone out by accident
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لا يمكنك إزالة صلاحية المشرف أو إيقاف حسابك بنفسك")
    if req.role is not None:
        user.role = req.role
    if req.is_active is not None:
        user.is_active = req.is_active
    db.commit()
    return UserOut.model_validate(user, from_attributes=True)
