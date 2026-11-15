import re
from typing import Optional

HELP_TEXT = (
    "I can help you decide what to eat. Try:\n"
    "• \"Recommend me a lunch\": one meal idea\n"
    "• \"Plan my day\": breakfast, lunch, dinner and a snack\n"
    "• \"A Thai recipe\" or \"a meat meal\": pick by cuisine or food type\n"
    "• \"Something spicy\" or \"high protein dinner\": match your taste or goal\n"
    "The more you like or skip, the better the picks get. Type !help any time to see this again."
)

_KEY_ROWS = ("qwertyuiop", "asdfghjkl", "zxcvbnm")
_KEY_RUNS = {row[i:i + 4] for row in _KEY_ROWS for i in range(len(row) - 3)}   
_THAI = re.compile(r"[฀-๿]")
_LETTER = re.compile(r"[A-Za-z฀-๿]")
_HELP_PHRASES = {
    "help", "help me", "what can you do", "how to use", "how do i use this",
    "ช่วยเหลือ", "วิธีใช้", "ทำอะไรได้บ้าง", "ใช้ยังไง", "ช่วยด้วย",
}


def has_thai(text: str) -> bool:
    return bool(_THAI.search(text))


def help_reply(text: str = "") -> str:
    return HELP_TEXT


def unclear_reply(text: str = "") -> str:
    return HELP_TEXT


def is_help_request(text: str) -> bool:
    t = re.sub(r"[\s!?.,]+$", "", text.strip().lower()).lstrip("!/ ")
    return t in _HELP_PHRASES


def looks_like_nonsense(text: str) -> bool:
    # ตรวจข้อความว่าดูเป็นข้อความที่ไม่สมเหตุสมผลหรือไม่ โดยไม่ต้องใช้โมเดล LLM
    m = text.strip()
    if not _LETTER.search(m):                       
        return True
    squeezed = re.sub(r"\s+", "", m)
    if re.fullmatch(r"(.)\1{3,}", squeezed): 
        return True
    if m.isascii() and " " not in m and len(m) <= 24:
        w = m.lower()
        if len(w) >= 5 and not re.search(r"[aeiouy]", w):
            return True
        if any(w[i:i + 4] in _KEY_RUNS for i in range(len(w) - 3)):
            return True
        if re.search(r"[b-df-hj-np-tv-xz]{6,}", w):
            return True
    return False


def canned_reply(text: str) -> Optional[str]:
    # เช็คว่าข้อความเป็นคำขอความช่วยเหลือหรือไม่ เร็วๆโดยไม่ต้องใช้โมเดล LLM
    if is_help_request(text):
        return help_reply(text)
    if looks_like_nonsense(text):
        return unclear_reply(text)
    return None
