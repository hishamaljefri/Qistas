"""Find the page of every 'Figure N:' / 'Table N:' caption in the rendered PDF."""
import json, re, sys
import pymupdf
doc = pymupdf.open(sys.argv[1])
texts = [p.get_text() for p in doc]
start = next(i for i, t in enumerate(texts) if "Access to legal assistance in Saudi Arabia is constrained" in t)
wanted = json.load(open("captions.json"))
pages = {}
for i in range(start, len(texts)):
    for m in re.finditer(r"\b(Figure|Table) (\d+):", texts[i]):
        pages.setdefault(f"{m.group(1)} {m.group(2)}", i + 1)
missing = [w for w in wanted if w not in pages]
old = json.load(open("pages.json")) if __import__("os").path.exists("pages.json") else {}
json.dump(pages, open("pages.json", "w"), indent=0)
print(f"{len(pages)} captions located, missing {missing}, body starts p{start+1}, changed: {pages != old}, total pages {len(texts)}")
