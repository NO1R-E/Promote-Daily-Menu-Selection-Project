from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

MEAL_TYPES = ("breakfast", "lunch", "dinner", "snack")
DEFAULT_TIMEZONE = "Asia/Bangkok"

def infer_meal_type(explicit: Optional[str], tz: str = DEFAULT_TIMEZONE) -> str:
    if explicit in MEAL_TYPES:
        return explicit
    hour = datetime.now(ZoneInfo(tz)).hour
    if hour < 10:
        return "breakfast"
    if hour < 15:
        return "lunch"
    return "dinner"