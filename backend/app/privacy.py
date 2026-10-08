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
    def __init__(self, existing: dict[str, str] | None = None) -> None:
        """existing: a previous placeholder -> value map (e.g. when a saved case is edited),
        so the same person keeps the same placeholder and numbering continues."""
        self.mapping: dict[str, str] = {}
        self._by_value: dict[tuple[str, str], str] = {}
        self._counters: dict[str, int] = {}
        for ph, value in (existing or {}).items():
            kind, _, number = ph.strip("[]").rpartition("_")
            self.mapping[ph] = value
            self._by_value[(kind, value)] = ph
            if number.isdigit():
                self._counters[kind] = max(self._counters.get(kind, 0), int(number))

    def placeholder(self, kind: str, value: str) -> str:
        key = (kind, value)
        if key not in self._by_value:
            self._counters[kind] = self._counters.get(kind, 0) + 1
            ph = f"[{kind}_{self._counters[kind]}]"
            self._by_value[key] = ph
            self.mapping[ph] = value
        return self._by_value[key]

    def replace_literal(self, text: str, value: str, kind: str) -> str:
        """Replace a name and its short forms (first/last name, a company's first word)."""
        value = value.strip()
        if len(value) < 2:
            return text
        ph = self.placeholder(kind, value)
        for variant in _variants(kind, value):
            text = _replace_word(text, variant, ph)
        # "خالد الغامدي" -> "[EMPLOYEE_1] [EMPLOYEE_1]" -> "[EMPLOYEE_1]"
        return re.sub(rf"{re.escape(ph)}(?:\s+{re.escape(ph)})+", ph, text)


def _replace_word(text: str, value: str, placeholder: str) -> str:
    # Arabic letters count as word characters, so \b-style guards work here;
    # allow attached prefixes like و/ب/ل/ك/ال (e.g. "وشركة", "لمحمد").
    pattern = re.compile(rf"(?<![\w])((?:[وبلكف]|ال)?){re.escape(value)}(?![\w])")
    return pattern.sub(lambda m: m.group(1) + placeholder, text)


# Common first words of company names that must not be masked on their own.
_GENERIC_COMPANY_WORDS = {
    "المتحدة", "الوطنية", "العربية", "السعودية", "الدولية", "العالمية", "الحديثة", "المتقدمة",
    "الأولى", "الشرق", "الخليج", "مكتب", "مركز", "مصنع", "مؤسسة", "شركة",
}


def _variants(kind: str, value: str) -> list[str]:
    """The full value first, then short forms people use in the same text."""
    if kind in ("EMPLOYEE", "PERSON"):
        return _name_parts(value)
    if kind == "EMPLOYER":
        words = value.split()
        if len(words) > 1 and len(words[0]) >= 4 and words[0] not in _GENERIC_COMPANY_WORDS:
            return [value, words[0]]
    return [value]


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
        # stop at a describing word, or at "و + word" after the name ("النخبة المتحدة والموظف")
        if w in _NOT_A_NAME or (kept and w.startswith("و") and len(w) > 2):
            break
        kept.append(w)
    return " ".join(kept)


def mask_many(
    texts: list[str],
    employee_name: str | None = None,
    employer_name: str | None = None,
    other_names: list[str] | None = None,
    existing: dict[str, str] | None = None,
) -> tuple[list[str], dict[str, str]]:
    """Mask several texts (e.g. a case description and its attached documents) with one shared
    numbering, so a company named in both becomes the same [EMPLOYER_1] everywhere."""
    m = _Masker(existing)
    texts = [t.translate(_ARABIC_DIGITS) for t in texts]

    # 1. names the user gave us explicitly
    for name, kind in [(employee_name, "EMPLOYEE"), (employer_name, "EMPLOYER")] + [
        (n, "PERSON") for n in (other_names or [])
    ]:
        if not name or not name.strip():
            continue
        texts[:] = [m.replace_literal(t, " ".join(name.split()), kind) for t in texts]  # parts map to one placeholder

    # 2. structured identifiers
    for kind, pattern in _PATTERNS:
        texts[:] = [pattern.sub(lambda mt, kind=kind: m.placeholder(kind, mt.group(0).strip()), t) for t in texts]
    texts[:] = [_REFERENCE_NO.sub(lambda mt: mt.group(1) + m.placeholder("REFERENCE_NO", mt.group(2)), t) for t in texts]

    # 3. company and person names introduced by a lead word ("شركة الأفق", "اسمي سعد"),
    #    replaced in every text, not only the one where the lead word appeared
    for lead, kind in [(_COMPANY_LEAD, "EMPLOYER"), (_PERSON_LEAD, "PERSON")]:
        names = {_trim_name(found.group(1)) for t in texts for found in lead.finditer(t)}
        for name in sorted((n for n in names if n and "[" not in n), key=len, reverse=True):
            texts[:] = [m.replace_literal(t, name, kind) for t in texts]

    # 4. values already known from an earlier version of this case (e.g. the user edits the text)
    for ph, value in (existing or {}).items():
        texts[:] = [m.replace_literal(t, value, ph.strip("[]").rpartition("_")[0]) for t in texts]

    return texts, m.mapping


def mask(
    text: str,
    employee_name: str | None = None,
    employer_name: str | None = None,
    other_names: list[str] | None = None,
) -> MaskResult:
    (masked,), mapping = mask_many([text], employee_name, employer_name, other_names)
    return MaskResult(masked_text=masked, mapping=mapping)


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
