"""Arabic text normalization for keyword search.

Users write the same word many ways (مكافأة / مكافاة / مكافئة, نهاية / نهايه), so
both the stored text and the question are normalized the same way before
Postgres full-text matching. Embeddings use the original text.
"""
import re

from pyarabic import araby

_ALEF = re.compile("[أإآٱ]")
_EXTRA_SPACE = re.compile(r"\s+")


def normalize(text: str) -> str:
    text = araby.strip_tashkeel(text)
    text = araby.strip_tatweel(text)
    text = _ALEF.sub("ا", text)
    text = text.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي").replace("ء", "")
    return _EXTRA_SPACE.sub(" ", text).strip()


_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

_UNITS = {
    "الاولي": 1, "الحاديه": 1, "الثانيه": 2, "الثالثه": 3, "الرابعه": 4, "الخامسه": 5,
    "السادسه": 6, "السابعه": 7, "الثامنه": 8, "التاسعه": 9,
}
_TENS = {
    "العشرون": 20, "الثلاثون": 30, "الاربعون": 40, "الخمسون": 50,
    "الستون": 60, "السبعون": 70, "الثمانون": 80, "التسعون": 90,
}


def ordinal_to_number(phrase: str) -> int | None:
    """'السابعة والسبعون' -> 77, 'العاشرة بعد المائتين' -> 210. None if not an ordinal."""
    # after normalize(): المائة -> المايه, المئة -> الميه, المائتين -> المايتين, المئتين -> الميتين
    s = normalize(phrase).replace("الميتين", "المايتين").replace("الميه", "المايه")
    n = 0
    if "بعد المايتين" in s:
        n, s = 200, s.replace("بعد المايتين", "")
    elif "بعد المايه" in s:
        n, s = 100, s.replace("بعد المايه", "")
    elif s.strip() == "المايه":
        return 100
    elif s.strip() in ("المايتان", "المايتين"):
        return 200
    s = s.strip()
    if s == "العاشره":
        return n + 10
    found = False
    for word, value in _TENS.items():
        if word in s:
            n, s, found = n + value, s.replace(word, ""), True
    if "عشره" in s:
        n, s, found = n + 10, s.replace("عشره", ""), True
    for word, value in _UNITS.items():
        if word in s:
            n, found = n + value, True
            break
    return n if found and n else None


_ARTICLE_DIGITS = re.compile(r"(?:المادة|الماده|مادة|ماده|م)\s*[\(\[]?\s*(\d{1,3})\s*[\)\]]?")
_ARTICLE_WORDS = re.compile(r"(?:المادة|الماده)\s+((?:[^\s\d؟?.,،]+\s*){1,5})")


def find_article_numbers(question: str) -> list[int]:
    """Article numbers the user referred to explicitly: 'المادة 77', 'م(80)', 'المادة السابعة والسبعون'."""
    text = question.translate(_ARABIC_DIGITS)
    numbers = [int(m.group(1)) for m in _ARTICLE_DIGITS.finditer(text)]
    if not numbers:
        for m in _ARTICLE_WORDS.finditer(text):
            words = m.group(1).split()
            # try the longest prefix that parses ("الثامنة والعشرون بعد المائتين من النظام")
            for end in range(len(words), 0, -1):
                value = ordinal_to_number(" ".join(words[:end]))
                if value:
                    numbers.append(value)
                    break
    return list(dict.fromkeys(n for n in numbers if 1 <= n <= 245))
