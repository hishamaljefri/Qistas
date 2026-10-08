"""Upload a document and get its text back for review (FR4, FR5).

The text is returned to the user, who reviews it and sends it with the case
(AnalyzeRequest.documents). The file itself is not stored.
"""
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from google.genai import errors as gemini_errors
from pydantic import BaseModel

from app.auth import current_user
from app.documents import MAX_BYTES, DocumentError, extract
from app.models import User
from app.schemas import DocumentMethod

log = logging.getLogger("qistas")
router = APIRouter(prefix="/api/documents", tags=["documents"])


class ExtractResponse(BaseModel):
    filename: str
    method: DocumentMethod
    pages: int
    text: str


@router.post("/extract", response_model=ExtractResponse)
def extract_document(
    file: UploadFile = File(description="PDF أو صورة (JPG/PNG/WEBP)، حتى 10 ميجابايت و10 صفحات"),
    cloud_ocr_consent: bool = Form(False, description="موافقة على إرسال الصور/المسح الضوئي إلى Gemini للقراءة"),
    force_ocr: bool = Form(False, description="قراءة PDF بالـ OCR حتى لو احتوى نصاً (إذا ظهر النص المستخرج مشوّهاً)"),
    _: User = Depends(current_user),
) -> ExtractResponse:
    data = file.file.read(MAX_BYTES + 1)
    try:
        result = extract(data, cloud_ocr_consent, force_ocr)
    except DocumentError as e:
        raise HTTPException(e.status, {"code": e.code, "message": e.message}) from e
    except gemini_errors.APIError as e:
        log.warning("Gemini OCR error %s: %s", e.code, e.message)
        raise HTTPException(503, {"code": "ai_busy", "message": "خدمة القراءة الآلية مشغولة، حاول بعد قليل"}) from e
    filename = (file.filename or "document")[:200]
    return ExtractResponse(filename=filename, method=result.method, pages=result.pages, text=result.text)
