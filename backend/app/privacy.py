"""Mask personal information before a case is sent to the LLM.

Detected values are replaced with placeholders such as [EMPLOYEE_1],
[NATIONAL_ID_1] or [PHONE_1]. The placeholder -> original map stays on the
server only, is used to restore the values in the answer shown to the user, and
is never stored in the database or sent to Gemini.

Rule-based (regular expressions + names the user typed in the form), not a full
Arabic NER model, which would be too heavy for this deployment. See the report's
limitations section.
"""
import re
from dataclasses import dataclass, field

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

# Order matters: longer / more specific patterns first.
_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("IBAN", re.compile(r"\bSA(?:\s?\d){22}\b", re.IGNORECASE)),
    ("PHONE", re.compile(r"(?<!\d)(?:\+966|00966|966|0)?\s?5\d(?:[\s-]?\d){7}(?!\d)")),
    # Saudi national ID starts with 1, iqama (resident ID) with 2; both 10 digits.
    ("NATIONAL_ID", re.compile(r"(?<!\d)[12]\d{9}(?!\d)")),
]

# Reference numbers only when introduced by a label, so salaries/amounts are kept.
_REFERENCE_NO = re.compile(
    r"((?:رقم العقد|عقد رقم|رقم القضية|قضية رقم|رقم الدعوى|دعوى رقم|السجل التجاري|سجل تجاري|رقم الملف|رقم المنشأة)"
    r"[\s:#]*)([\w/-]*\d[\w/-]*)"
)

# Words after شركة/مؤسسة... that describe the company rather than name it.
_NOT_A_NAME = {
    "في", "من", "على", "الى", "إلى", "عن", "التي", "الذي", "و", "او", "أو", "ثم", "لمدة", "منذ", "براتب",
    "كبيرة", "صغيرة", "خاصة", "حكومية", "أهلية", "اهلية", "سعودية", "أجنبية", "اجنبية", "محلية", "عالمية",
    "مقاولات", "كانت", "وقد", "لكن", "حيث", "بعد", "قبل", "عند", "مع", "لم", "لا",
}
_COMPANY_LEAD = re.compile(r"(?:شركة|شركه|مؤسسة|مؤسسه|مصنع|مجموعة|مجموعه)\s+((?:[^\s،,.؛:!?؟()]+\s*){1,3})")
_PERSON_LEAD = re.compile(r"(?:اسمي|أدعى|ادعى)\s+((?:[^\s،,.؛:!?؟()]+\s*){1,3})")
_NAME_PARTICLES = {"بن", "ابن", "بنت", "آل", "ال", "عبد", "أبو", "ابو", "أم", "ام"}


@dataclass
class MaskResult:
    masked_text: str
    mapping: dict[str, str] = field(default_factory=dict)  # placeholder -> original

    @property
    def counts(self) -> dict[str, int]:
        result: dict[str, int] = {}
        for placeholder in self.mapping:
            kind = placeholder.strip("[]").rsplit("_", 1)[0]
            result[kind] = result.get(kind, 0) + 1
        return result


class _Masker:
    def __init__(self) -> None:
        self.mapping: dict[str, str] = {}
        self._by_value: dict[tuple[str, str], str] = {}
        self._counters: dict[str, int] = {}

    def placeholder(self, kind: str, value: str) -> str:
        key = (kind, value)
        if key not in self._by_value:
            self._counters[kind] = self._counters.get(kind, 0) + 1
            ph = f"[{kind}_{self._counters[kind]}]"
            self._by_value[key] = ph
            self.mapping[ph] = value
        return self._by_value[key]

    def replace_literal(self, text: str, value: str, kind: str) -> str:
        value = value.strip()
        if len(value) < 2:
            return text
        # Arabic letters count as word characters, so \b-style guards work here;
        # allow attached prefixes like و/ب/ل/ك/ال (e.g. "وشركة", "لمحمد").
        pattern = re.compile(rf"(?<![\w])((?:[وبلكف]|ال)?){re.escape(value)}(?![\w])")
        return pattern.sub(lambda m: m.group(1) + self.placeholder(kind, value), text)


def _name_parts(full_name: str) -> list[str]:
    """Full name first, then the first and last names on their own ('محمد', 'العتيبي')."""
    full_name = " ".join(full_name.split())
    words = [w for w in full_name.split() if w not in _NAME_PARTICLES and len(w) >= 3]
    parts = [full_name]
    if len(words) > 1:
        parts += [words[0], words[-1]]
    return parts


def _trim_name(words: str) -> str:
    kept = []
    for w in words.split():
        if w in _NOT_A_NAME:
            break
        kept.append(w)
    return " ".join(kept)


def mask(
    text: str,
    employee_name: str | None = None,
    employer_name: str | None = None,
    other_names: list[str] | None = None,
) -> MaskResult:
    m = _Masker()
    text = text.translate(_ARABIC_DIGITS)

    # 1. names the user gave us explicitly
    for name, kind in [(employee_name, "EMPLOYEE"), (employer_name, "EMPLOYER")] + [
        (n, "PERSON") for n in (other_names or [])
    ]:
        if not name or not name.strip():
            continue
        for part in _name_parts(name):
            # map every part to the same placeholder as the full name
            ph = m.placeholder(kind, " ".join(name.split()))
            text = re.sub(
                rf"(?<![\w])((?:[وبلكف]|ال)?){re.escape(part)}(?![\w])", lambda mt: mt.group(1) + ph, text
            )

    # 2. structured identifiers
    for kind, pattern in _PATTERNS:
        text = pattern.sub(lambda mt: m.placeholder(kind, mt.group(0).strip()), text)
    text = _REFERENCE_NO.sub(lambda mt: mt.group(1) + m.placeholder("REFERENCE_NO", mt.group(2)), text)

    # 3. company and person names introduced by a lead word ("شركة الأفق", "اسمي سعد")
    for lead, kind in [(_COMPANY_LEAD, "EMPLOYER"), (_PERSON_LEAD, "PERSON")]:
        for found in list(lead.finditer(text)):
            name = _trim_name(found.group(1))
            if name and "[" not in name:
                text = m.replace_literal(text, name, kind)

    return MaskResult(masked_text=text, mapping=m.mapping)


def unmask(value, mapping: dict[str, str]):
    """Restore originals inside strings, lists and dicts (e.g. the LLM's JSON answer)."""
    if isinstance(value, str):
        for placeholder, original in mapping.items():
            value = value.replace(placeholder, original)
        return value
    if isinstance(value, list):
        return [unmask(v, mapping) for v in value]
    if isinstance(value, dict):
        return {k: unmask(v, mapping) for k, v in value.items()}
    return value
