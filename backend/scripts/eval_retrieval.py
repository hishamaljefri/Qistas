"""Measure how well search finds the right Labor Law article.

For each question in data/eval/retrieval_questions.jsonl, checks whether an
expected article appears in the top results, for each search method:
  hit@1  correct article ranked first
  hit@5  correct article anywhere in the top 5
  MRR    mean reciprocal rank (1 = always first, 0.5 = usually second, ...)

Usage (from backend/):  uv run python -m scripts.eval_retrieval [--show-misses]
"""
import argparse
import json

from app.config import DATA_DIR
from app.search import search

QUESTIONS_FILE = DATA_DIR / "eval" / "retrieval_questions.jsonl"
K = 5


def rank_of_expected(results, expected: set[str]) -> int | None:
    for rank, r in enumerate(results, 1):
        if r.source_code == "LABOR_LAW" and r.article_number in expected:
            return rank
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-misses", action="store_true")
    args = parser.parse_args()

    questions = [json.loads(line) for line in QUESTIONS_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
    print(f"{len(questions)} questions, top-{K}\n")
    print(f"{'method':<10}{'hit@1':>8}{'hit@5':>8}{'MRR':>8}")

    misses = {}
    for mode in ("keyword", "vector", "hybrid"):
        hit1 = hit5 = rr = 0.0
        for q in questions:
            rank = rank_of_expected(search(q["question"], k=K, mode=mode), set(q["expected_labor_articles"]))
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
                got = [r.article_number for r in search(q["question"], k=K, mode=mode) if r.source_code == "LABOR_LAW"]
                print(f"  {q['id']} expected {q['expected_labor_articles']} got {got}  {q['question']}")


if __name__ == "__main__":
    main()
