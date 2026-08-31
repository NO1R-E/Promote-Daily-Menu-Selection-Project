import json
import itertools
from typing import List
from groq import Groq, RateLimitError
from config import (
    GROQ_API_KEYS,
    GROQ_SMALL_MODEL,
    GROQ_LARGE_MODEL,
)
from schemas import ClassificationResult, ChatMessage

# Round-Robin cycle across your Groq keys
_key_cycle = itertools.cycle(GROQ_API_KEYS) if GROQ_API_KEYS else None

INTENT_SYSTEM_PROMPT = """
You are an intent classification engine for a meal and nutrition assistant.
Classify the user input strictly into ONE of these two intents:

1. "meal_recommendation": User is directly or indirectly asking for food, dish ideas, meal plans, or dietary recommendations.
2. "usual_chat": General conversation, greetings, nutrition questions, or recipe follow-ups.

Output MUST be a valid JSON object following this format:
{
  "intent": "usual_chat" | "meal_recommendation",
  "preferences": ["extracted preference 1", "extracted preference 2"]
}

Rules for preferences:
- Extract dietary needs, taste constraints, or health goals into standardized lowercase terms (e.g., "low salt", "no sweet", "high protein").
- Consider both past context and the new message when extracting preferences.
- If intent is "usual_chat" or no preferences exist, return an empty array [].
"""

def get_groq_client() -> Groq:
    if not _key_cycle:
        raise ValueError("GROQ_API_KEYS list is empty in configuration.")
    return Groq(api_key=next(_key_cycle))

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

async def classify_intent(message: str, history: List[ChatMessage] = []) -> ClassificationResult:
    messages = [{"role": "system", "content": INTENT_SYSTEM_PROMPT}]
    
    # Pass up to last 5 messages for context
    for chat in history[-5:]:
        messages.append({"role": chat.role, "content": chat.content})
        
    messages.append({"role": "user", "content": message})

    raw_json = await execute_groq_request(
        messages=messages, 
        model=GROQ_SMALL_MODEL, 
        response_format={"type": "json_object"}
    )
    return ClassificationResult(**json.loads(raw_json))

async def generate_usual_chat(message: str, history: List[ChatMessage] = []) -> str:
    messages = [{"role": "system", "content": "You are a helpful meal and nutrition assistant."}]
    
    for chat in history:
        messages.append({"role": chat.role, "content": chat.content})

    messages.append({"role": "user", "content": message})

    return await execute_groq_request(
        messages=messages, 
        model=GROQ_LARGE_MODEL
    )