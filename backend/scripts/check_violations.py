"""Automatic checks on data/kb/violations_112377.json before a person reviews it.

Flags: gaps or repeats in the violation numbers of a section, rows without a description,
unknown classifications, and penalty cells that contain neither an amount nor a known
non-monetary penalty. Prints one line per problem with the PDF page to look at.

Usage (from backend/):  uv run python -m scripts.check_violations
"""
import json
import re
from collections import defaultdict

from app.config import DATA_DIR

FILE = DATA_DIR / "kb" / "violations_112377.json"
CLASSES = {"جسيمة", "غير جسيمة"}
# non-monetary penalties used in the table (recruitment licences, warnings, bans)
PENALTY_WORDS = ("لا ينطبق", "لا يوجد", "إنذار", "انذار", "تعليق", "سحب", "منع", "إيقاف", "ايقاف", "إلغاء", "الغاء", "حجب")


def problems(data: dict) -> list[str]:
    out = []
    by_section = defaultdict(list)
    for r in data["rows"]:
        by_section[r["section"]].append(r)
        where = f"p.{r['page']} ({r['section']}) {r['number']}"
        if len(r["description"].strip()) < 10:
            out.append(f"{where}: description missing or too short")
        if r["classification"] is not None and r["classification"].strip() not in CLASSES:
            out.append(f"{where}: unknown classification {r['classification']!r}")
        if not r["penalties"]:
            out.append(f"{where}: no penalty columns")
        for p in r["penalties"]:
            v = p["value"].strip()
            if not re.search(r"\d", v) and not any(w in v for w in PENALTY_WORDS):
                out.append(f"{where}: check penalty {p['column']!r} = {v!r}")
    for section, rows in by_section.items():
        numbers = [r["number"] for r in rows]
        expected = list(range(1, max(numbers) + 1))
        missing = sorted(set(expected) - set(numbers))
        repeated = sorted({n for n in numbers if numbers.count(n) > 1})
        if missing:
            out.append(f"section {section}: missing numbers {missing}")
        if repeated:
            out.append(f"section {section}: repeated numbers {repeated}")
        if numbers != sorted(numbers):
            out.append(f"section {section}: numbers out of order")
    return out


def main() -> None:
    data = json.loads(FILE.read_text(encoding="utf-8"))
    counts = {s["letter"]: sum(r["section"] == s["letter"] for r in data["rows"]) for s in data["sections"]}
    print(f"{len(data['rows'])} rows in {len(data['sections'])} sections: {counts}")
    found = problems(data)
    print(*found or ["no automatic problems found"], sep="\n")
    print(f"review: {data.get('review')}")
    print(f"corrections: {len(data.get('corrections', []))}")


if __name__ == "__main__":
    main()
