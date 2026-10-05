"""Analyze a labor case from the terminal (same pipeline as the API).

Usage (from backend/):
  uv run python -m scripts.analyze_cli "وصف الحالة..." [--employee "الاسم"] [--employer "الشركة"] [--json]
"""
import argparse
import json

from app.analysis import analyze_case
from app.schemas import AnalyzeRequest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("description")
    parser.add_argument("--employee")
    parser.add_argument("--employer")
    parser.add_argument("--json", action="store_true", help="print the full API response")
    args = parser.parse_args()

    res = analyze_case(AnalyzeRequest(description=args.description, employee_name=args.employee, employer_name=args.employer))
    if args.json:
        print(json.dumps(res.model_dump(mode="json"), ensure_ascii=False, indent=2))
        return

    a = res.analysis
    print(f"case #{res.case_id} | {res.model_version} | {res.latency_ms} ms | masked: {res.pii_masked}")
    print(f"sent to model: {res.masked_description}\n")
    print("الوقائع:", a.facts_summary, "\n")
    print("المسائل:", *[f"  - {x}" for x in a.legal_issues], sep="\n")
    print("\nالمواد:", *[f"  - [{c.record_id}] {c.title}: {c.why}" for c in res.citations], sep="\n")
    print("\nالتحليل:", a.analysis)
    print("\nمعلومات ناقصة:", *[f"  - {x}" for x in a.missing_information], sep="\n")
    print(f"\nالنتيجة المتوقعة ({a.expected_outcome.likelihood}):", a.expected_outcome.summary)
    print("السبب:", a.expected_outcome.reasoning)
    print("\nالخطوات:", *[f"  {i}. {x}" for i, x in enumerate(a.recommended_steps, 1)], sep="\n")
    if res.grounding_warnings:
        print("\n⚠", *res.grounding_warnings, sep="\n  ")
    print("\nالمواد المسترجعة:", ", ".join(r.record_id for r in res.retrieved))


if __name__ == "__main__":
    main()
