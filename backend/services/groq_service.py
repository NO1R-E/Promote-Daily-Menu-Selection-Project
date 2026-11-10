import json
import itertools
from typing import List, Optional
from groq import Groq, RateLimitError
from services.preferences import PREFERENCE_WEIGHTS, clean_preferences
from config import (
    GROQ_API_KEYS,
    GROQ_SMALL_MODEL,
    GROQ_LARGE_MODEL,
)
from schemas import ClassificationResult, ChatMessage, IntentEnum

# Round-Robin cycle across your Groq keys
_key_cycle = itertools.cycle(GROQ_API_KEYS) if GROQ_API_KEYS else None

_ALLOWED = ", ".join(f'"{k}"' for k in PREFERENCE_WEIGHTS)

INTENT_SYSTEM_PROMPT = f"""
You are an intent classification engine for a meal and nutrition assistant.
Classify the user input strictly into ONE of these intents:

1. "meal_recommendation": the user wants ideas for ONE dish or ONE meal (e.g. "what should I eat for lunch?").
2. "meal_plan": the user wants a whole day, or several meals, planned at once (e.g. "plan my meals for today", "what should I eat all day?").
3. "usual_chat": general conversation, greetings, thanks, nutrition questions, or recipe follow-ups.
4. "unclear": ONLY when the message is gibberish or has no discernible meaning (random characters, keyboard mashing, a lone symbol).
   Never use it for greetings, thanks, small talk, off-topic but understandable questions, or short food words. When in doubt use "usual_chat".

Output MUST be a valid JSON object following this format:
{{
  "intent": "usual_chat" | "meal_recommendation" | "meal_plan" | "unclear",
  "meal_type": null,
  "preferences": []
}}

Rules for meal_type:
- Only for "meal_recommendation": "breakfast", "lunch", "dinner" or "snack" if the user names a meal or a clear time of day. Otherwise null.
- For every other intent, null.

Rules for preferences:
- "preferences" may ONLY contain values from this list: {_ALLOWED}.
- Map the user's wording to the closest value, e.g. "less salty" -> "low_sodium",
  "not too sweet" -> "low_sugar", "more protein" -> "high_protein".
- Never invent new values. If nothing in the list applies, return [].
- Consider both past context and the new message.
- If intent is "usual_chat" or "unclear", return [].
"""

def get_groq_client() -> Groq:
    if not _key_cycle:
        raise ValueError("GROQ_API_KEYS list is empty in configuration.")
    return Groq(api_key=next(_key_cycle))

def get_health_check_client() -> Groq:
    """Dedicated client for health checks only — always uses a single fixed
    key and never touches the rotation used for real chat traffic."""
    if not GROQ_API_KEYS:
        raise ValueError("GROQ_API_KEYS list is empty in configuration.")
    return Groq(api_key=GROQ_API_KEYS[0])

async def execute_groq_request(
    messages: list, 
    model: str, 
    response_format=None
) -> str:
    num_primary_keys = len(GROQ_API_KEYS)

    for _ in range(num_primary_keys):
        client = get_groq_client()
        try:
            completion = client.chat.completions.create(
                messages=messages,
                model=model,
                temperature=0.1,
                response_format=response_format,
            )
            return completion.choices[0].message.content
        except RateLimitError:
            print(f"Rate limit hit for model '{model}'. Rotating key...")
            continue

    raise RuntimeError(f"All GROQ_API_KEYS exceeded rate limits for model: {model}")

def _focus_prompt(options: Optional[List[dict]]) -> str:
    if not options:
        return ""
    lines = "\n".join(
        f'- {t["id"]}: {t["name"]} [{t["group"]}] - {t["description"]}' for t in options
    )
    return (
        '\n\nFocus tag (only for "meal_recommendation" and "meal_plan"):\n'
        '- Also return "focus_tag": <id> | null in the JSON.\n'
        '- Set it ONLY when the user explicitly asks for one of the tags below, e.g. "a Thai recipe",\n'
        '  "a meat meal", "something spicy". Use ONLY an id from the list.\n'
        '- If the user names several, pick the one they stress most. Never guess from vague wording.\n'
        '- For "usual_chat", or when nothing applies, use null.\n'
        f"Allowed focus tags:\n{lines}\n"
    )


async def classify_intent(
    message: str, history: List[ChatMessage] = [], focus_options: Optional[List[dict]] = None
) -> ClassificationResult:
    messages = [{"role": "system", "content": INTENT_SYSTEM_PROMPT + _focus_prompt(focus_options)}]
    
    # Pass up to last 5 messages for context
    for chat in history[-5:]:
        messages.append({"role": chat.role, "content": chat.content})
        
    messages.append({"role": "user", "content": message})

    raw_json = await execute_groq_request(
        messages=messages,
        model=GROQ_SMALL_MODEL,
        response_format={"type": "json_object"},
    )
    print(f"Raw classification result: {raw_json}")
    data = json.loads(raw_json)
    raw_focus = data.pop("focus_tag", None)          # parsed by hand: a bad value must not break the chat
    result = ClassificationResult(**data)
    try:
        result.focus_tag = int(raw_focus) if raw_focus is not None else None
    except (TypeError, ValueError):
        result.focus_tag = None
    if result.intent in (IntentEnum.USUAL_CHAT, IntentEnum.UNCLEAR) or result.focus_tag not in {t["id"] for t in focus_options or []}:
        result.focus_tag = None
    result.preferences = clean_preferences(result.preferences)   # clean generated preferences
    return result

async def generate_usual_chat(message: str, history: List[ChatMessage] = []) -> str:
    system_prompt = (
        "You are a helpful meal and nutrition assistant designed for a mobile chat UI.\n"
        "Guidelines:\n"
        "- Keep answers short, direct, and easy to read on a mobile screen (1-3 sentences max).\n"
        "- Avoid long explanations unless specifically asked for details.\n"
        "- Do not overload the user with multiple options or questions.\n"
        "- If appropriate, end with at most ONE simple follow-up question."
    )

    messages = [{"role": "system", "content": system_prompt}]
    
    for chat in history:
        messages.append({"role": chat.role, "content": chat.content})

    messages.append({"role": "user", "content": message})

    return await execute_groq_request(
        messages=messages, 
        model=GROQ_LARGE_MODEL
    )