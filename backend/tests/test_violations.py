"""The violations table: loader (scripts/load_kb.violation_rows), automatic checks and search helpers."""
from app.search import asks_about_penalties, other_sector_prefixes
from scripts.check_violations import problems
from scripts.load_kb import violation_rows

DATA = {
    "sections": [{"letter": "أ", "title": "فئة المخالفات العامة لكافة الأنشطة"}, {"letter": "هـ", "title": "فئة خاصة"}],
    "rows": [
        {
            "section": "أ", "subsection": None, "number": 20, "page": 3, "classification": "جسيمة", "notes": None,
            "description": "قيام صاحب العمل بتشغيل عامل غير سعودي دون حصوله على رخصة عمل",
            "penalties": [
                {"column": "فئة ج (20 عامل فأقل)", "value": "10,000 تتعدد بتعدد العمال"},
                {"column": "فئة أ (50 عامل فأعلى)", "value": "10,000 تتعدد بتعدد العمال"},
            ],
        },
        {
            "section": "هـ", "subsection": "مخالفات العامل", "number": 1, "page": 9, "classification": "غير جسيمة", "notes": None,
            "description": "مخالفة تجريبية للعامل", "penalties": [{"column": "قيمة الغرامة", "value": "300"}],
        },
    ],
    "paragraphs": [
        {"page": 1, "text": "قرار وزاري"},
        {"page": 24, "text": "سادساً: يتم مضاعفة العقوبة في حال تكرار المخالفة."},
    ],
}


def test_each_violation_becomes_a_provision_with_its_fines():
    rows = {r["record_id"]: r for r in violation_rows(DATA)}
    v = rows["VIO-A-020"]
    assert v["content_type"] == "جدول مخالفات" and v["article_number"] is None  # never matched as "المادة 20"
    assert "رخصة عمل" in v["text_ar"] and "تصنيف المخالفة: جسيمة" in v["text_ar"]
    assert "فئة ج (20 عامل فأقل): 10,000 تتعدد بتعدد العمال" in v["text_ar"]
    assert rows["VIO-E-001"]["hierarchy"] == "(ه) فئة خاصة | مخالفات العامل"  # "هـ" written with a tatweel


def test_only_numbered_clauses_of_the_decision_are_kept():
    rows = violation_rows(DATA)
    clauses = [r for r in rows if r["record_id"].startswith("VIO-CLAUSE")]
    assert [c["record_id"] for c in clauses] == ["VIO-CLAUSE-06"] and "مضاعفة" in clauses[0]["text_ar"]


def test_checks_find_gaps_and_unclear_penalties():
    data = {
        "sections": DATA["sections"],
        "rows": [
            {**DATA["rows"][1], "number": 1},
            {**DATA["rows"][1], "number": 3, "penalties": [{"column": "قيمة الغرامة", "value": "؟"}]},
        ],
    }
    found = problems(data)
    assert any("missing numbers [2]" in f for f in found)
    assert any("check penalty" in f for f in found)


def test_penalty_questions_and_sector_sections_are_recognized():
    assert asks_about_penalties("كم غرامة تشغيل عامل بدون رخصة؟") and asks_about_penalties("ما العقوبة على صاحب العمل؟")
    assert not asks_about_penalties("كم مدة إجازة الحج؟")
    # a general case skips the domestic (J) and agricultural (K) rows; a domestic case keeps J
    assert {"VIO-J-", "VIO-K-"} <= set(other_sector_prefixes("صاحب العمل يحتفظ بجواز سفري"))
    assert "VIO-J-" not in other_sector_prefixes("العاملة المنزلية لم تستلم راتبها")
