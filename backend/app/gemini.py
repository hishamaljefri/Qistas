"""Shared Gemini client, retry helper and model fallback.

The free tier answers "429 Too Many Requests" when called too fast, and the service
sometimes returns 500/503 ("overloaded"). with_retry() waits and tries again;
generate() additionally falls back to other models when the main one stays unavailable.
"""
import logging
import time
from collections.abc import Callable
from typing import Any, TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from app.config import GEMINI_API_KEY, GEMINI_CHAT_MODEL, GEMINI_FALLBACK_MODELS

T = TypeVar("T")


class GenerationBlocked(Exception):
    """Gemini returned no content, e.g. RECITATION (refuses to copy published text verbatim) or SAFETY."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason

RETRYABLE_CODES = (429, 500, 503)
log = logging.getLogger("qistas")

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


def generate(
    contents: Any,
    *,
    system: str | None = None,
    schema: type[BaseModel] | None = None,
    temperature: float = 0.2,
) -> tuple[Any, str]:
    """Call the chat model (with fallbacks). Returns (parsed schema object or text, model version)."""
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        response_mime_type="application/json" if schema else None,
        response_schema=schema,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    models = [GEMINI_CHAT_MODEL, *GEMINI_FALLBACK_MODELS]
    for i, model in enumerate(models):
        try:
            response = with_retry(
                lambda: get_client().models.generate_content(model=model, contents=contents, config=config),
                max_retries=2,
                first_wait=4,
            )
            break
        except errors.APIError as e:
            if e.code not in RETRYABLE_CODES or i == len(models) - 1:
                raise
            log.warning("%s unavailable (%s), switching to %s", model, e.code, models[i + 1])
            print(f"  {model} unavailable ({e.code}), switching to {models[i + 1]}")
    version = response.model_version or model
    if not response.text:
        reasons = [str(getattr(c.finish_reason, "name", c.finish_reason)) for c in (response.candidates or [])]
        raise GenerationBlocked(reasons[0] if reasons else "EMPTY")
    if schema is None:
        return response.text.strip(), version
    parsed = response.parsed if isinstance(response.parsed, schema) else schema.model_validate_json(response.text)
    return parsed, version
