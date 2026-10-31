"""Measure how well search finds the right provision (Labor Law article or table row).

For each question in data/eval/retrieval_questions.jsonl (or the file given with
--questions), checks whether an expected provision appears in the top results, for each
search method. A question names Labor Law article numbers (expected_labor_articles)
and/or exact record ids (expected_record_ids, e.g. violations-table rows).
  hit@1  correct article ranked first
  hit@5  correct article anywhere in the top 5
  MRR    mean reciprocal rank (1 = always first, 0.5 = usually second, ...)

Usage (from backend/):  uv run python -m scripts.eval_retrieval [--show-misses]
                        uv run python -m scripts.eval_retrieval --questions data/eval/violation_questions.jsonl
"""
import argparse
import json
from pathlib import Path

from app.config import DATA_DIR
from app.search import search

QUESTIONS_FILE = DATA_DIR / "eval" / "retrieval_questions.jsonl"
K = 5


def rank_of_expected(results, articles: set[str], record_ids: set[str] = frozenset()) -> int | None:
    for rank, r in enumerate(results, 1):
        if (r.source_code == "LABOR_LAW" and r.article_number in articles) or r.record_id in record_ids:
            return rank
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-misses", action="store_true")
    parser.add_argument("--questions", type=Path, default=QUESTIONS_FILE, help="a .jsonl file of questions")
    args = parser.parse_args()

    path = args.questions if args.questions.is_absolute() else DATA_DIR.parent / args.questions
    questions = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    print(f"{len(questions)} questions, top-{K}\n")
    print(f"{'method':<10}{'hit@1':>8}{'hit@5':>8}{'MRR':>8}")

    misses = {}
    for mode in ("keyword", "vector", "hybrid"):
        hit1 = hit5 = rr = 0.0
        for q in questions:
            expected = set(q.get("expected_labor_articles", [])), set(q.get("expected_record_ids", []))
            rank = rank_of_expected(search(q["question"], k=K, mode=mode), *expected)
            if rank:
                hit5 += 1
                hit1 += rank == 1
                rr += 1 / rank
            else:
                misses.setdefault(mode, []).append(q)
        n = len(questions)
        print(f"{mode:<10}{hit1 / n:>8.0%}{hit5 / n:>8.0%}{rr / n:>8.2f}")

    if args.show_misses:
        for mode, missed in misses.items():
            print(f"\nmissed by {mode}:")
            for q in missed:
                got = [r.article_number if r.source_code == "LABOR_LAW" else r.record_id for r in search(q["question"], k=K, mode=mode)]
                want = q.get("expected_labor_articles", []) + q.get("expected_record_ids", [])
                print(f"  {q['id']} expected {want} got {got}  {q['question']}")


if __name__ == "__main__":
    main()
