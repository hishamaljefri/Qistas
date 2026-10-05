from app.analysis import check_grounding
from app.schemas import CitedArticle, ExpectedOutcome, LLMAnalysis


def _analysis(ids):
    return LLMAnalysis(
        facts_summary="",
        legal_issues=[],
        applicable_articles=[CitedArticle(record_id=i, why="") for i in ids],
        analysis="",
        missing_information=[],
        expected_outcome=ExpectedOutcome(summary="", likelihood="متوسط", reasoning=""),
        recommended_steps=[],
        entitlements=[],
    )


def test_invented_citations_are_removed_and_reported():
    checked, warnings = check_grounding(_analysis(["LAW-0077", "LAW-0999", "LAW-0084"]), {"LAW-0077", "LAW-0084"})
    assert [c.record_id for c in checked.applicable_articles] == ["LAW-0077", "LAW-0084"]
    assert len(warnings) == 1 and "LAW-0999" in warnings[0]


def test_all_valid_citations_pass_untouched():
    checked, warnings = check_grounding(_analysis(["LAW-0080"]), {"LAW-0080", "LAW-0081"})
    assert len(checked.applicable_articles) == 1 and warnings == []
