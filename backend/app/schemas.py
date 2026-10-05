"""Request / response shapes for the API, and the JSON shape Gemini must answer in."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.entitlements import EntitlementInputs, EntitlementResult

# ---------- what Gemini returns (enforced with a response schema) ----------


class CitedArticle(BaseModel):
    record_id: str = Field(description="معرّف المادة كما ورد بين القوسين المربعين في المواد المقدمة، مثل LAW-0077")
    why: str = Field(description="سبب انطباق هذه المادة على الحالة، في جملة أو جملتين")


class ExpectedOutcome(BaseModel):
    summary: str = Field(description="النتيجة المتوقعة للقضية في جملتين أو ثلاث")
    likelihood: Literal["مرتفع", "متوسط", "منخفض"] = Field(description="مدى ترجيح هذه النتيجة")
    reasoning: str = Field(description="لماذا هذا الترجيح، مع الإشارة إلى المواد")


class LLMAnalysis(BaseModel):
    facts_summary: str = Field(description="ملخص محايد لوقائع الحالة كما رواها المستخدم")
    legal_issues: list[str] = Field(description="المسائل القانونية التي تثيرها الحالة")
    applicable_articles: list[CitedArticle] = Field(description="المواد المنطبقة، من المواد المقدمة فقط")
    analysis: str = Field(description="التحليل القانوني: تطبيق المواد على الوقائع خطوة بخطوة")
    missing_information: list[str] = Field(
        description="معلومات أو مستندات ناقصة تؤثر على النتيجة، بصيغة أسئلة موجهة للمستخدم"
    )
    expected_outcome: ExpectedOutcome
    recommended_steps: list[str] = Field(description="خطوات عملية مقترحة للمستخدم بالترتيب")
    entitlements: list[EntitlementInputs] = Field(
        description="المستحقات المالية المنطبقة ومدخلات حسابها كما وردت في الوقائع؛ يتم الحساب آلياً، فلا تحسب المبالغ بنفسك"
    )


# ---------- API ----------


class AnalyzeRequest(BaseModel):
    description: str = Field(min_length=30, max_length=8000, description="وصف الحالة العمالية")
    employee_name: str | None = Field(default=None, max_length=120, description="اسم العامل (سيتم إخفاؤه)")
    employer_name: str | None = Field(default=None, max_length=200, description="اسم صاحب العمل/المنشأة (سيتم إخفاؤه)")
    # Asked explicitly because masking the name can hide it, and some rules differ by gender
    # (e.g. art. 87: full end-of-service award for a woman resigning after marriage).
    employee_gender: Literal["male", "female"] | None = Field(default=None, description="جنس العامل")


class ArticleOut(BaseModel):
    record_id: str
    source_code: str
    source_name: str
    article_number: str | None
    title: str
    text: str
    status: str
    status_note: str | None = None


class CitationOut(ArticleOut):
    why: str


class AnalysisOut(BaseModel):
    facts_summary: str
    legal_issues: list[str]
    analysis: str
    missing_information: list[str]
    expected_outcome: ExpectedOutcome
    recommended_steps: list[str]


class AnalyzeResponse(BaseModel):
    case_id: int
    analysis: AnalysisOut
    citations: list[CitationOut]
    entitlements: list[EntitlementResult] = Field(description="المستحقات المالية محسوبة آلياً وفق مواد النظام")
    entitlements_total: float | None = Field(description="مجموع المستحقات القابلة للحساب")
    retrieved: list[ArticleOut] = Field(description="كل المواد التي استرجعها البحث وأُرسلت للنموذج")
    masked_description: str = Field(description="النص كما أُرسل للنموذج بعد إخفاء البيانات الشخصية")
    pii_masked: dict[str, int]
    grounding_warnings: list[str]
    knowledge_base_as_of: date
    model_version: str | None
    latency_ms: int
    disclaimer: str


class SearchHit(ArticleOut):
    score: float


class SourceOut(BaseModel):
    code: str
    name_ar: str
    legal_level: str
    source_url: str | None
    collected_on: date
    priority: str


class KBInfo(BaseModel):
    sources: list[SourceOut]
    provisions: int
    knowledge_base_as_of: date
