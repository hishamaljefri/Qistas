"""Read the Violations and Penalties Table (ministerial decision 112377) into structured rows.

The official PDF is a 24-page scan (its built-in text layer is unreadable), so each page
image is read by Gemini into a fixed JSON shape. Each page's result is cached in
data/raw/violations_pages/ (git-ignored), so re-running only reads pages that failed.
The assembled file data/kb/violations_112377.json must be checked by a person against
the PDF (see scripts/check_violations.py). Corrections are made in that file and listed in
its "corrections" field, so it is not overwritten unless --reassemble is given.

Usage (from backend/):  uv run python -m scripts.extract_violations [--pages 3 4] [--force] [--reassemble]
"""
import argparse
import json
import re

import pymupdf
from google.genai import types
from pydantic import BaseModel, Field

from app.config import DATA_DIR
from app.gemini import generate

PDF_FILE = DATA_DIR / "raw" / "hrsd_violations_table_decision_112377_2026-02.pdf"
CACHE_DIR = DATA_DIR / "raw" / "violations_pages"
OUT_FILE = DATA_DIR / "kb" / "violations_112377.json"


class Penalty(BaseModel):
    column: str = Field(description="عنوان العمود كما هو مطبوع في رأس الجدول، مثل: فئة ج (20 عاملاً فأقل)، أو قيمة الغرامة، أو عقوبة المنشأة")
    value: str = Field(description="محتوى الخلية كما هو، بالأرقام الإنجليزية، مثل: 10,000 أو 300 تتعدد بتعدد العمال أو لا ينطبق أو تعليق الترخيص لمدة شهرين")


class Row(BaseModel):
    section: str = Field(description="حرف الفئة التي ينتمي لها الصف، مثل: أ أو ب أو ي")
    subsection: str | None = Field(default=None, description="العنوان الفرعي داخل الفئة إن وجد، مثل: مخالفات صاحب العمل، أو مخالفات العامل، أو المخالفات الإدارية")
    number: int = Field(description="رقم المخالفة في عمود م")
    description: str = Field(description="وصف المخالفة كاملاً كما هو")
    classification: str | None = Field(default=None, description="تصنيف المخالفة: جسيمة أو غير جسيمة، إن وُجد العمود")
    penalties: list[Penalty] = Field(description="باقي أعمدة الصف بالترتيب من اليمين إلى اليسار: كل عمود وقيمته")
    notes: str | None = Field(default=None, description="عمود الملاحظات إن وجد")


class SectionHeader(BaseModel):
    letter: str = Field(description="حرف الفئة، مثل: ب")
    title: str = Field(description="عنوان الفئة كاملاً، مثل: فئة المخالفات الخاصة بنشاط تشغيل المناجم والمحاجر")


class PageExtract(BaseModel):
    new_sections: list[SectionHeader] = Field(description="عناوين الفئات التي تبدأ في هذه الصفحة، بالترتيب")
    rows: list[Row] = Field(description="كل صفوف جداول المخالفات في هذه الصفحة، بالترتيب من الأعلى إلى الأسفل")
    paragraphs: list[str] = Field(description="الفقرات النصية خارج الجداول (مثل ديباجة القرار أو البنود ثانياً وثالثاً...)، كل فقرة أو بند في عنصر، دون ترويسة الصفحة وتذييلها")


PROMPT = """هذه صفحة ممسوحة ضوئياً من قرار وزاري سعودي منشور (جدول المخالفات والعقوبات لنظام العمل).
استخرج محتواها إلى الحقول المطلوبة بدقة تامة:
- لا تلخص ولا تعيد الصياغة؛ انقل وصف كل مخالفة كما هو.
- اكتب كل الأرقام بالأرقام الإنجليزية (0-9)، والمبالغ بفاصلة الآلاف مثل 10,000.
- كل صف من صفوف الجدول عنصر مستقل، حتى لو كان الوصف على عدة أسطر.
- انقل عناوين أعمدة الغرامات كما هي في رأس الجدول. إذا لم يكن في هذه الصفحة رأس جدول، فاستخدم أعمدة الفئة السابقة المذكورة أدناه.
- تجاهل ترويسة الصفحة (اسم الوزارة والرقم والتاريخ) وتذييلها (العنوان ورقم الصفحة).
{context}"""


def page_png(doc, index: int) -> bytes:
    return doc[index].get_pixmap(dpi=200).tobytes("png")


def context_text(last: dict | None) -> str:
    if not last:
        return "هذه أول صفحة."
    cols = "، ".join(last["columns"]) or "غير معروفة"
    sub = f"، العنوان الفرعي: {last['subsection']}" if last.get("subsection") else ""
    return f"الصفحة السابقة انتهت داخل الفئة ({last['section']}){sub}، وأعمدة الغرامات فيها: {cols}. آخر رقم مخالفة فيها: {last['number']}."


def extract_page(doc, index: int, last: dict | None) -> dict:
    part = types.Part.from_bytes(data=page_png(doc, index), mime_type="image/png")
    result, model = generate([part, PROMPT.format(context=context_text(last))], schema=PageExtract, temperature=0.0)
    return {"page": index + 1, "model": model, **result.model_dump()}


def last_state(page: dict, previous: dict | None) -> dict | None:
    if not page["rows"]:
        return previous
    r = page["rows"][-1]
    return {"section": r["section"], "subsection": r["subsection"], "number": r["number"], "columns": [p["column"] for p in r["penalties"]]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, nargs="*", help="only these page numbers (1-based)")
    parser.add_argument("--force", action="store_true", help="read again even if cached")
    parser.add_argument("--reassemble", action="store_true", help="overwrite the reviewed file in data/kb")
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(PDF_FILE)
    last = None
    pages = []
    for i in range(doc.page_count):
        cache = CACHE_DIR / f"page_{i + 1:02d}.json"
        wanted = args.pages is None or (i + 1) in args.pages
        if wanted and (args.force or not cache.exists()):
            print(f"reading page {i + 1}/{doc.page_count}...")
            cache.write_text(json.dumps(extract_page(doc, i, last), ensure_ascii=False, indent=1), encoding="utf-8")
        if cache.exists():
            page = json.loads(cache.read_text(encoding="utf-8"))
            pages.append(page)
            last = last_state(page, last)

    if len(pages) < doc.page_count:
        print(f"{len(pages)}/{doc.page_count} pages read; run again without --pages to finish")
        return
    if OUT_FILE.exists() and not args.reassemble:
        print(f"{OUT_FILE} exists (it may contain manual corrections); use --reassemble to overwrite it")
        return

    sections, rows, paragraphs = {}, [], []
    for page in pages:
        for s in page["new_sections"]:
            sections.setdefault(s["letter"], s["title"])
        for r in page["rows"]:
            # a cell's line breaks are only wrapping; empty cells are merged cells in the scan
            penalties = [{**p, "value": re.sub(r"\s+", " ", p["value"]).strip()} for p in r["penalties"]]
            rows.append({**r, "penalties": [p for p in penalties if p["value"]], "page": page["page"]})
        paragraphs += [{"page": page["page"], "text": t} for t in page["paragraphs"]]
    OUT_FILE.write_text(
        json.dumps(
            {
                "_comment": "Violations and Penalties Table, ministerial decision 112377 (HRSD, 2026-02). "
                "Read from the scanned PDF by scripts/extract_violations.py; checked by a person against the PDF.",
                "review": {"fines_checked_against_pdf": None, "team_review_done": False},
                "corrections": [],
                "sections": [{"letter": k, "title": v} for k, v in sections.items()],
                "rows": rows,
                "paragraphs": paragraphs,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"saved {OUT_FILE}: {len(sections)} sections, {len(rows)} rows, {len(paragraphs)} paragraphs")


if __name__ == "__main__":
    main()
