"""Run the blind test cases and compare the system's answer with the answer key.

Only the case text (and optional names) is sent to the pipeline. The answer key
(must_cite, expected_outcome) stays in this script and is never sent to Gemini.

Usage (from backend/):  uv run python -m scripts.run_blind_cases [--only B03]
Results are saved to data/eval/results/blind_<date-time>.json
"""
import argparse
import json
from datetime import datetime

from scripts._cli_user import analyze_case
from app.config import DATA_DIR
from app.schemas import AnalyzeRequest

CASES_FILE = DATA_DIR / "eval" / "blind_cases.json"
RESULTS_DIR = DATA_DIR / "eval" / "results"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="run a single case id prefix, e.g. B03")
    args = parser.parse_args()

    cases = json.loads(CASES_FILE.read_text(encoding="utf-8"))["cases"]
    if args.only:
        cases = [c for c in cases if c["id"].startswith(args.only)]

    rows = []
    for c in cases:
        # --- only these three fields leave this script ---
        request = AnalyzeRequest(
            description=c["description"],
            employee_name=c["employee_name"],
            employer_name=c["employer_name"],
            employee_gender=c.get("employee_gender"),
        )
        res = analyze_case(request)

        cited = [x.article_number for x in res.citations if x.source_code == "LABOR_LAW"]
        missing = [a for a in c["must_cite"] if a not in cited]
        outcome = res.analysis.expected_outcome
        rows.append(
            {
                "id": c["id"],
                "case_id": res.case_id,
                "must_cite": c["must_cite"],
                "cited_labor_law": cited,
                "missing_required": missing,
                "all_required_cited": not missing,
                "expected_outcome_key": c["expected_outcome"],
                "model_outcome": outcome.summary,
                "model_likelihood": outcome.likelihood,
                "model_missing_information": res.analysis.missing_information,
                "entitlements": [e.model_dump() for e in res.entitlements],
                "grounding_warnings": res.grounding_warnings,
                "model_version": res.model_version,
                "latency_ms": res.latency_ms,
            }
        )
        mark = "✅" if not missing else "❌"
        print(f"\n{mark} {c['id']}  ({res.model_version}, {res.latency_ms / 1000:.0f}s)  case #{res.case_id}")
        print(f"   required: {c['must_cite']}   cited: {cited}")
        print(f"   KEY:   {c['expected_outcome']}")
        print(f"   MODEL ({outcome.likelihood}): {outcome.summary}")
        for e in res.entitlements:
            print(f"   💰 {e.title_ar} (م{e.article}): {e.amount if e.amount is not None else '—'}  | {e.formula_ar}")

    passed = sum(r["all_required_cited"] for r in rows)
    print(f"\nrequired articles cited in {passed}/{len(rows)} cases")
    print("(read KEY vs MODEL above to judge whether each conclusion is correct)")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = RESULTS_DIR / f"blind_{datetime.now():%Y%m%d_%H%M}.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"saved {out}")


if __name__ == "__main__":
    main()
