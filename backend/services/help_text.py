import re
from typing import Optional

HELP_EN = (
    "I can help you decide what to eat. Try:\n"
    "• \"Recommend me a lunch\": one meal idea\n"
    "• \"Plan my day\": breakfast, lunch, dinner and a snack\n"
    "• \"A Thai recipe\" or \"a meat meal\": pick by cuisine or food type\n"
    "• \"Something spicy\" or \"high protein dinner\": match your taste or goal\n"
    "The more you like or skip, the better the picks get."
)

HELP_TH = (
    "ฉันช่วยแนะนำเมนูให้ได้ ลองพิมพ์ เช่น\n"
    "• \"แนะนำมื้อเที่ยง\": เมนูเดียว\n"
    "• \"จัดเมนูวันนี้\": มื้อเช้า กลางวัน เย็น และของว่าง\n"
    "• \"อยากกินอาหารไทย\" หรือ \"เมนูเนื้อสัตว์\": เลือกตามประเภทอาหาร\n"
    "• \"เผ็ดๆ\" หรือ \"มื้อเย็นโปรตีนสูง\": ปรับตามรสชาติหรือเป้าหมายของคุณ\n"
    "ยิ่งกดชอบหรือข้าม ระบบจะแนะนำได้ตรงใจมากขึ้น"
)

UNCLEAR_EN = (
    "Sorry, I didn't catch that. I can recommend a meal or plan your day. "
    "Try \"recommend me a lunch\", \"plan my day\" or \"a Thai recipe\". "
    "Type !help to see everything I can do."
)

UNCLEAR_TH = (
    "ขอโทษนะ ฉันไม่เข้าใจข้อความนี้ ฉันแนะนำเมนูหรือจัดมื้ออาหารให้ได้ "
    "ลองพิมพ์ \"แนะนำมื้อเที่ยง\", \"จัดเมนูวันนี้\" หรือ \"อยากกินอาหารไทย\" "
    "พิมพ์ !help เพื่อดูวิธีใช้ทั้งหมด"
)

_KEY_ROWS = ("qwertyuiop", "asdfghjkl", "zxcvbnm")
_KEY_RUNS = {row[i:i + 4] for row in _KEY_ROWS for i in range(len(row) - 3)}   # "asdf", "sdfg", "zxcv" ...
_THAI = re.compile(r"[฀-๿]")
_LETTER = re.compile(r"[A-Za-z฀-๿]")
_HELP_PHRASES = {
    "help", "help me", "what can you do", "how to use", "how do i use this",
    "ช่วยเหลือ", "วิธีใช้", "ทำอะไรได้บ้าง", "ใช้ยังไง", "ช่วยด้วย",
}


def has_thai(text: str) -> bool:
    return bool(_THAI.search(text))


def help_reply(text: str) -> str:
    return HELP_TH if has_thai(text) else HELP_EN


def unclear_reply(text: str) -> str:
    return UNCLEAR_TH if has_thai(text) else UNCLEAR_EN


def is_help_request(text: str) -> bool:
    t = re.sub(r"[\s!?.,]+$", "", text.strip().lower()).lstrip("!/ ")
    return t in _HELP_PHRASES


def looks_like_nonsense(text: str) -> bool:
    """Cheap rules for the obvious cases only. Anything subtler is left to the classifier's "unclear" intent.
    Deliberately no dictionary: romanized Thai dish names (pad kra pao, som tam) are real input."""
    m = text.strip()
    if not _LETTER.search(m):                         # empty, digits, symbols or emoji only
        return True
    squeezed = re.sub(r"\s+", "", m)
    if re.fullmatch(r"(.)\1{3,}", squeezed):          # "aaaaa", "ฮ่าๆๆๆๆ" style repeats
        return True
    if m.isascii() and " " not in m and len(m) <= 24:  # a single latin "word" that is keyboard mashing
        w = m.lower()
        if len(w) >= 5 and not re.search(r"[aeiouy]", w):   # "sdfgh"
            return True
        if any(w[i:i + 4] in _KEY_RUNS for i in range(len(w) - 3)):   # four neighbouring keys: "asdfgh", "zxcv"
            return True
        if re.search(r"[b-df-hj-np-tv-xz]{6,}", w):          # "qwrtypsd": six consonants in a row
            return True
    return False


def canned_reply(text: str) -> Optional[str]:
    """The reply for "!help" or obvious nonsense, else None (go on to the classifier)."""
    if is_help_request(text):
        return help_reply(text)
    if looks_like_nonsense(text):
        return unclear_reply(text)
    return None
