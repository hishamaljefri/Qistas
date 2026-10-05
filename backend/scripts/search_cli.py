"""Try the search from the terminal.

Usage (from backend/):
  uv run python -m scripts.search_cli "كم مدة الإشعار لإنهاء العقد؟"
  uv run python -m scripts.search_cli "..." --mode vector -k 10
"""
import argparse

from app.search import search


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("question")
    parser.add_argument("-k", type=int, default=5)
    parser.add_argument("--mode", choices=["hybrid", "vector", "keyword"], default="hybrid")
    args = parser.parse_args()

    for i, r in enumerate(search(args.question, k=args.k, mode=args.mode), 1):
        status = "" if r.status == "in_force" else f"  [{r.status}]"
        print(f"\n{i}. {r.source_code} | {r.title}{status}   score={r.score}  via={r.matched_by}")
        print("   " + r.text[:300].replace("\n", " ") + ("..." if len(r.text) > 300 else ""))


if __name__ == "__main__":
    main()
