"""Create the first admin account, or promote an existing account to admin.

Usage (from backend/):
  uv run python -m scripts.create_admin                # asks for username, email, password
  uv run python -m scripts.create_admin --promote NAME # make an existing user admin
"""
import argparse
import getpass

from pydantic import ValidationError
from sqlalchemy import select

from app.auth import hash_password
from app.db import SessionLocal
from app.models import User
from app.schemas import RegisterRequest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--promote", metavar="USERNAME")
    args = parser.parse_args()

    with SessionLocal.begin() as db:
        if args.promote:
            user = db.scalar(select(User).where(User.username == args.promote.lower()))
            if user is None:
                raise SystemExit(f"no user named {args.promote}")
            user.role, user.is_active = "admin", True
            print(f"{user.username} is now an admin")
            return

        username = input("admin username: ").strip()
        email = input("admin email: ").strip()
        password = getpass.getpass("admin password (min 8 chars): ")
        try:
            req = RegisterRequest(username=username, email=email, password=password)
        except ValidationError as e:
            raise SystemExit(f"invalid input: {e.errors()[0]['msg']}") from None
        if db.scalar(select(User).where(User.username == req.username.lower())):
            raise SystemExit("username already exists; use --promote")
        db.add(User(username=req.username.lower(), email=req.email.lower(), password_hash=hash_password(req.password), role="admin", is_active=True))
        print(f"admin {req.username.lower()} created")


if __name__ == "__main__":
    main()
