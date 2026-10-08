"""Read the text of an uploaded document (FR4, FR5).

- PDFs that contain real text are read locally with PyMuPDF: nothing leaves the server.
- Scanned PDFs and photos need OCR. They are sent to Gemini only if the user explicitly
  consents, because the image cannot be masked before it is read (documented deviation
  from CS498 SR7 for scans only). The extracted text is masked like any other case text
  before analysis.
- Basic safety checks (CS498 SR6): the file type is decided by its signature, not its name;
  size, page count and image dimensions are limited; encrypted PDFs and PDFs carrying
  embedded files are rejected. The uploaded file itself is never stored.
"""
import re
import unicodedata
from dataclasses import dataclass

import pymupdf
from google.genai import types

from app.gemini import GenerationBlocked, generate

MAX_BYTES = 10 * 1024 * 1024
MAX_PAGES = 10
MAX_IMAGE_SIDE = 8000
MAX_TEXT_CHARS = 30000
# A page with fewer letters than this is treated as scanned (an image, not text)
MIN_LETTERS_PER_PAGE = 40

OCR_PROMPT = (
    "انسخ كل النص الموجود في هذا المستند حرفياً وبنفس ترتيبه، بالعربية أو الإنجليزية كما هو، "
    "دون تلخيص أو شرح أو ترجمة أو إضافة. اكتب الجداول سطراً سطراً. "
    "إذا لم يوجد نص مقروء فاكتب فقط: لا يوجد نص."
)


class DocumentError(Exception):
    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


@dataclass
class Extracted:
    method: str  # text_layer | gemini_ocr
    pages: int
    text: str


def detect_type(data: bytes) -> str | None:
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _clean(text: str) -> str:
    # NFKC turns Arabic "presentation forms" (ﻣﻘﺪ) that some PDFs use back into normal letters
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()[:MAX_TEXT_CHARS]


def _letters(text: str) -> int:
    return sum(ch.isalpha() for ch in text)


def _ocr(data: bytes, mime: str) -> str:
    part = types.Part.from_bytes(data=data, mime_type=mime)
    try:
        text, _ = generate([part, OCR_PROMPT], temperature=0.0)
    except GenerationBlocked as e:
        if e.reason == "RECITATION":
            # Gemini will not copy out text that is already published (e.g. a page of the law)
            raise DocumentError(
                "published_text",
                "يبدو أن هذا المستند نص منشور (مثل صفحة من نظام أو لائحة)، ولا تعيد الخدمة نسخه حرفياً. "
                "مواد النظام موجودة أصلاً في قاعدة المعرفة؛ ارفع المستندات الخاصة بحالتك فقط (مثل العقد أو خطاب الفصل).",
                422,
            ) from e
        raise DocumentError("ocr_failed", "تعذّرت قراءة المستند آلياً؛ اكتب المعلومات المهمة في وصف الحالة", 422) from e
    return "" if text.strip() == "لا يوجد نص." or text.strip() == "لا يوجد نص" else text


def extract(data: bytes, cloud_ocr_consent: bool, force_ocr: bool = False) -> Extracted:
    """force_ocr: the user saw garbled text from a PDF's text layer (some PDF generators store
    Arabic ligatures in the wrong order) and asks for OCR instead."""
    if len(data) > MAX_BYTES:
        raise DocumentError("too_large", "حجم الملف يتجاوز 10 ميجابايت", 413)
    mime = detect_type(data)
    if mime is None:
        raise DocumentError("unsupported_type", "نوع الملف غير مدعوم. الأنواع المسموحة: PDF وJPG وPNG وWEBP", 415)

    try:
        doc = pymupdf.open(stream=data, filetype="pdf" if mime == "application/pdf" else mime.split("/")[1])
    except Exception:
        raise DocumentError("unreadable", "تعذّرت قراءة الملف؛ قد يكون تالفاً", 422) from None

    with doc:
        if mime == "application/pdf":
            if doc.needs_pass or doc.is_encrypted:
                raise DocumentError("encrypted", "الملف محمي بكلمة مرور", 422)
            if doc.embfile_count() > 0:
                raise DocumentError("embedded_files", "الملف يحتوي على ملفات مضمّنة، ولا يُقبل لأسباب أمنية", 422)
            if doc.page_count > MAX_PAGES:
                raise DocumentError("too_many_pages", f"عدد الصفحات يتجاوز {MAX_PAGES}", 422)
            pages = doc.page_count
            text = _clean("\n\n".join(page.get_text() for page in doc))
            if not force_ocr and _letters(text) >= MIN_LETTERS_PER_PAGE * pages:
                return Extracted("text_layer", pages, text)
        else:
            rect = doc[0].rect
            if max(rect.width, rect.height) > MAX_IMAGE_SIDE:
                raise DocumentError("image_too_large", "أبعاد الصورة كبيرة جداً", 422)
            pages = 1

    # scanned PDF or photo: needs OCR
    if not cloud_ocr_consent:
        raise DocumentError(
            "consent_required",
            "هذا الملف صورة أو مستند ممسوح ضوئياً، وقراءته تتطلب إرساله إلى خدمة Gemini من Google كما هو "
            "(دون إخفاء الأسماء). وافق على ذلك لإكمال القراءة، أو اكتب المعلومات المهمة بنفسك في وصف الحالة.",
            422,
        )
    text = _clean(_ocr(data, mime))
    if not text:
        raise DocumentError("no_text", "لم يُعثر على نص مقروء في الملف", 422)
    return Extracted("gemini_ocr", pages, text)
