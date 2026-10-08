"""Request / response shapes for the API, and the JSON shape Gemini must answer in."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.entitlements import EntitlementInputs, EntitlementKind, EntitlementResult

# ---------- what Gemini returns (enforced with a response schema) ----------


class CitedArticle(BaseModel):
    record_id: str = Field(description="معرّف المادة كما ورد بين القوسين المربعين في المواد المقدمة، مثل LAW-0077")
    why: str = Field(description="سبب انطباق هذه المادة على الحالة، في جملة أو جملتين")


class ExpectedOutcome(BaseModel):
    summary: str = Field(description="النتيجة المتوقعة للقضية في جملتين أو ثلاث")
    likelihood: Literal["مرتفع", "متوسط", "منخفض"] = Field(description="مدى ترجيح هذه النتيجة")
    reasoning: str = Field(description="لماذا هذا الترجيح، مع الإشارة إلى المواد")


class LLMAnalysis(BaseModel):
    title: str = Field(description="عنوان قصير للقضية في 3 إلى 7 كلمات، مثل: فصل دون إشعار بعد 6 سنوات")
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


DocumentMethod = Literal["text_layer", "gemini_ocr"]


class AttachedDocument(BaseModel):
    """Text extracted by POST /api/documents/extract and reviewed by the user."""

    filename: str = Field(max_length=200)
    method: DocumentMethod
    pages: int | None = Field(default=None, ge=1, le=10)
    text: str = Field(min_length=1, max_length=30000)


class AnalyzeRequest(BaseModel):
    description: str = Field(min_length=30, max_length=8000, description="وصف الحالة العمالية")
    documents: list[AttachedDocument] = Field(default=[], max_length=3, description="نصوص المستندات المرفقة")
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


class DocumentOut(BaseModel):
    filename: str
    method: DocumentMethod
    pages: int | None


class AnalyzeResponse(BaseModel):
    """A case with its latest analysis. Real names are restored for the owner."""

    case_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    version: int = Field(description="رقم إصدار التحليل (يزيد عند تعديل الحالة وإعادة تحليلها)")
    employee_gender: Literal["male", "female"] | None
    description: str = Field(description="وصف الحالة كما كتبه المستخدم (بعد استعادة الأسماء)")
    documents: list[DocumentOut]
    latest_claim_id: int | None
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


# ---------- accounts ----------

USERNAME_PATTERN = r"^[A-Za-z0-9_.-]{3,32}$"
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class RegisterRequest(BaseModel):
    username: str = Field(pattern=USERNAME_PATTERN, description="3–32 حرفاً إنجليزياً أو أرقاماً أو . _ -")
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=8, max_length=64)

    @field_validator("password")
    @classmethod
    def bcrypt_limit(cls, v: str) -> str:
        if len(v.encode()) > 72:  # bcrypt only uses the first 72 bytes
            raise ValueError("كلمة المرور طويلة جداً")
        return v


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=254, description="اسم المستخدم أو البريد الإلكتروني")
    password: str = Field(min_length=1, max_length=64)


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: Literal["user", "admin"]
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="مدة صلاحية الرمز بالثواني")
    user: UserOut


class AdminUserUpdate(BaseModel):
    role: Literal["user", "admin"] | None = None
    is_active: bool | None = None


# ---------- my cases ----------


class CaseSummary(BaseModel):
    case_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    likelihood: Literal["مرتفع", "متوسط", "منخفض"] | None
    entitlements_total: float | None
    version: int
    has_claim: bool


class CaseRename(BaseModel):
    title: str = Field(min_length=2, max_length=120)


class ReanalyzeRequest(BaseModel):
    description: str = Field(min_length=30, max_length=8000)
    employee_name: str | None = Field(default=None, max_length=120)
    employer_name: str | None = Field(default=None, max_length=200)
    employee_gender: Literal["male", "female"] | None = None


# ---------- statement of claim (صحيفة الدعوى) ----------


class LLMClaimGround(BaseModel):
    record_id: str = Field(description="معرّف المادة كما ورد بين القوسين المربعين، مثل LAW-0077")
    argument: str = Field(description="وجه الاستدلال بالمادة على الطلبات، في جملة أو جملتين")


class LLMClaimRequest(BaseModel):
    kind: EntitlementKind | Literal["other"] = Field(
        description="نوع المستحق المالي إن كان الطلب مالياً، أو other للطلبات غير المالية مثل شهادة الخدمة"
    )
    text: str = Field(description="صياغة الطلب دون ذكر أي مبلغ، مثل: إلزام المدعى عليه بدفع مكافأة نهاية الخدمة")


class LLMClaim(BaseModel):
    subject: str = Field(description="موضوع الدعوى في سطر واحد")
    facts: list[str] = Field(description="الوقائع في فقرات مرقمة متسلسلة زمنياً، من الوقائع المذكورة فقط")
    legal_grounds: list[LLMClaimGround] = Field(description="الأسانيد النظامية من المواد المقدمة فقط")
    requests: list[LLMClaimRequest] = Field(description="الطلبات الختامية، كل طلب في عنصر")


class ClaimRequest(BaseModel):
    """Party details for the claim header. Inserted by code; never sent to the LLM."""

    plaintiff_national_id: str | None = Field(default=None, max_length=20)
    plaintiff_nationality: str | None = Field(default=None, max_length=40)
    plaintiff_phone: str | None = Field(default=None, max_length=20)
    plaintiff_address: str | None = Field(default=None, max_length=200)
    defendant_cr_number: str | None = Field(default=None, max_length=30, description="السجل التجاري أو الرقم الموحد للمنشأة")
    defendant_address: str | None = Field(default=None, max_length=200)
    court_city: str | None = Field(default=None, max_length=40, description="مدينة المحكمة العمالية")


class ClaimParty(BaseModel):
    label: str
    value: str | None


class ClaimGroundOut(BaseModel):
    record_id: str
    title: str
    argument: str


class ClaimRequestOut(BaseModel):
    text: str
    amount: float | None
    formula: str | None


class ClaimOut(BaseModel):
    claim_id: int
    case_id: int
    created_at: datetime
    model_version: str | None
    court_city: str | None
    plaintiff: list[ClaimParty]
    defendant: list[ClaimParty]
    subject: str
    facts: list[str]
    legal_grounds: list[ClaimGroundOut]
    requests: list[ClaimRequestOut]
    total: float | None
    notes: list[str]
    grounding_warnings: list[str]
    disclaimer: str
