"""Split provision text into searchable chunks.

Most articles are short and stay as one chunk. Long ones (e.g. regulations
article 14, ~11k characters) are split on paragraph / numbered-item boundaries
so each chunk stays within the embedding model's input limit. Every chunk is
prefixed with a header naming the source, article and chapter, so a chunk is
understandable on its own when shown to the LLM.
"""
import re

MAX_CHUNK_CHARS = 1500


def build_header(source_name: str, title: str, hierarchy: str | None, status_label: str | None) -> str:
    lines = [f"المصدر: {source_name}", f"العنوان: {title}"]
    if hierarchy:
        lines.append(f"التصنيف: {hierarchy}")
    if status_label:
        lines.append(f"الحالة: {status_label}")
    return "\n".join(lines)


def split_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text]

    # Paragraph boundaries first, then single lines, then sentences.
    pieces = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    if len(pieces) == 1:
        pieces = [p for p in text.split("\n") if p.strip()]

    units: list[str] = []
    for piece in pieces:
        if len(piece) <= max_chars:
            units.append(piece.strip())
        else:
            units.extend(s.strip() for s in re.split(r"(?<=[.؛:])\s+", piece) if s.strip())

    chunks: list[str] = []
    current = ""
    for unit in units:
        while len(unit) > max_chars:  # a single unsplittable run of text
            if current:
                chunks.append(current)
                current = ""
            chunks.append(unit[:max_chars])
            unit = unit[max_chars:]
        if current and len(current) + 1 + len(unit) > max_chars:
            chunks.append(current)
            current = unit
        else:
            current = f"{current}\n{unit}" if current else unit
    if current:
        chunks.append(current)
    return chunks
