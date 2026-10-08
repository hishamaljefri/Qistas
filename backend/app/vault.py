"""Encrypted storage of the real values behind placeholders (CS498 SR9).

The database keeps only masked text ("[EMPLOYEE_1] was dismissed…"). The map
{placeholder: real value} is encrypted with Fernet (AES-128-CBC + HMAC-SHA256) using
ENCRYPTION_KEY from .env and stored next to the case. It is decrypted only on the server,
for the case owner (or an admin), to show real names in answers, PDFs and claims.
It is never sent to the LLM. If ENCRYPTION_KEY is lost, the real values cannot be recovered.
"""
import json
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import ENCRYPTION_KEY

log = logging.getLogger("qistas")
_fernet = Fernet(ENCRYPTION_KEY.encode())


def seal(values: dict[str, str]) -> str | None:
    if not values:
        return None
    return _fernet.encrypt(json.dumps(values, ensure_ascii=False).encode()).decode()


def unseal(token: str | None) -> dict[str, str]:
    if not token:
        return {}
    try:
        return json.loads(_fernet.decrypt(token.encode()))
    except InvalidToken:
        log.error("could not decrypt a vault entry (wrong or rotated ENCRYPTION_KEY?)")
        return {}
