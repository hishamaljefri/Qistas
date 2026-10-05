"""Shared Gemini client and retry helper.

The free tier answers "429 Too Many Requests" when called too fast, and the
service occasionally returns 500/503. with_retry() waits and tries again
instead of failing immediately.
"""
import time
from collections.abc import Callable
from typing import TypeVar

from google import genai
from google.genai import errors

from app.config import GEMINI_API_KEY

T = TypeVar("T")
RETRYABLE_CODES = (429, 500, 503)

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is empty in .env")
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def with_retry(call: Callable[[], T], max_retries: int = 6, first_wait: float = 10) -> T:
    """Run call(); on a retryable Gemini error wait first_wait, 2x, 4x, ... seconds."""
    for attempt in range(max_retries):
        try:
            return call()
        except errors.APIError as e:
            if e.code not in RETRYABLE_CODES or attempt == max_retries - 1:
                raise
            wait = first_wait * 2**attempt
            print(f"  Gemini busy/rate-limited ({e.code}), waiting {wait:.0f}s...")
            time.sleep(wait)
    raise AssertionError("unreachable")
