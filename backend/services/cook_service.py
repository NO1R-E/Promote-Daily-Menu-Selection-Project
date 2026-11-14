"""Cooking mode: the chat walks the user through one recipe, step by step.

The client sends `cooking = {recipe_id, step}` with every message while cooking is on. `step` is the last step
the user was shown (0 = nothing yet). The server stays stateless: it answers and returns the new step.
Navigation (next / back / repeat / ingredients / exit / go to step N) is done by code; the LLM is only used to
label messages the rules can't read, and to answer questions about the recipe.
"""
import asyncio
import json
import re
from typing import List, Optional, Tuple

from config import GROQ_SMALL_MODEL, GROQ_LARGE_MODEL
from schemas import ChatMessage
from services.groq_service import execute_groq_request

COOK_HELP = (
    "You're in cooking mode. Say:\n"
    "• \"next\" or \"back\": move between steps\n"
    "• \"repeat\": show the current step again\n"
    "• \"ingredients\": list what you need\n"
    "• \"step 3\": jump to a step\n"
    "• or ask anything about this recipe\n"
    "Tap Exit above (or say \"exit\") to leave cooking mode."
)

_ACTIONS = {"next", "back", "repeat", "ingredients", "goto", "exit", "help", "question"}


def _norm(text: str) -> str:
    return re.sub(r"[\s!?.,]+", " ", text.strip().lower()).strip()


_EXIT = {"exit", "stop", "quit", "cancel", "end", "leave", "stop cooking", "exit cooking", "end cooking",
         "finish cooking", "exit cooking mode", "leave cooking mode"}
_NEXT = {"next", "next step", "continue", "go on", "ok", "okay", "done", "ready", "finished", "i'm done", "im done",
         "then", "what's next", "whats next", "what next", "go", "n", "yes", "yep", "yeah", "sure",
         "next please"}
_START = {"start", "start cooking", "begin", "let's start", "lets start", "let's cook", "lets cook"}
_BACK = {"back", "previous", "prev", "go back", "last step", "previous step", "back step", "b"}   # "back step" = the app's chip
_REPEAT = {"repeat", "again", "say again", "say that again", "repeat that", "current step", "what step",
           "which step", "what was that", "once more", "r"}
_INGREDIENTS = {"ingredients", "ingredient", "what do i need", "ingredient list", "list ingredients",
                "show ingredients", "what ingredients"}
_HELP = {"help", "!help", "commands", "what can you do"}
_GOTO = re.compile(r"^(?:go to |jump to |show |open )?step ?(\d{1,2})$")


def classify_by_rules(message: str, step: Optional[int] = None) -> Optional[Tuple[str, Optional[int]]]:
    t = _norm(message).lstrip("!/ ")
    if not t:
        return ("repeat", None)
    if t in _EXIT:
        return ("exit", None)
    if t in _HELP or message.strip().lower() == "!help":
        return ("help", None)
    if t in _START or t.startswith("start cooking "):
        return ("start", None)
    if step == 0 and t.startswith("cook "):       # the app opens with "Cook <recipe name>" (before step 1 only)
        return ("start", None)
    if t in _NEXT:
        return ("next", None)
    if t in _BACK:
        return ("back", None)
    if t in _REPEAT:
        return ("repeat", None)
    if t in _INGREDIENTS:
        return ("ingredients", None)
    m = _GOTO.match(t)
    if m:
        return ("goto", int(m.group(1)))
    return None


_COOK_CLASSIFIER_PROMPT = """You label one message sent while a user is being guided through a recipe.
Return ONLY JSON: {"action": "...", "step": null}
Actions:
- "start": wants to begin cooking
- "next": wants the next step ("ok what now", "finished that, continue")
- "back": wants the previous step
- "repeat": wants the current step again
- "ingredients": wants the ingredient list
- "goto": wants a specific step; put its number in "step"
- "exit": wants to stop cooking mode / do something else
- "question": anything else (asks about the recipe, substitutes, timing, technique, or chats)
When in doubt use "question"."""


async def classify_cook_message(message: str, step: int, total: int) -> Tuple[str, Optional[int]]:
    # the app opens with "Cook <recipe name>"; only before step 1, so "cook it longer?" later stays a question
    if step == 0 and _norm(message).startswith("cook "):
        return ("start", None)
    ruled = classify_by_rules(message, step)
    if ruled:
        return ruled
    try:
        raw = await execute_groq_request(
            messages=[
                {"role": "system", "content": _COOK_CLASSIFIER_PROMPT},
                {"role": "user", "content": f"Current step: {step} of {total}\nMessage: {message}"},
            ],
            model=GROQ_SMALL_MODEL,
            response_format={"type": "json_object"},
        )
        data = json.loads(raw)
        action = data.get("action")
        if action not in _ACTIONS or action == "help":
            return ("question", None)
        n = data.get("step")
        n = int(n) if n is not None and str(n).lstrip("-").isdigit() else None
        if action == "goto" and n is None:
            return ("question", None)
        return (action, n)
    except Exception as e:     # a failed label must never break cooking: treat as a question
        print(f"[cook] classify failed: {e}")
        return ("question", None)


def format_ingredients(recipe: dict) -> str:
    lines = [f"• {i}" for i in recipe["ingredients"]]
    return "\n".join(lines) if lines else "(no ingredient data)"


def intro_text(recipe: dict) -> str:
    total = len(recipe["steps"])
    return (
        f"Let's cook {recipe['name']}! It has {total} step{'s' if total != 1 else ''}.\n\n"
        f"Ingredients:\n{format_ingredients(recipe)}\n\n"
        "Say \"next\" when you're ready for step 1."
    )


def step_text(recipe: dict, step: int) -> str:
    total = len(recipe["steps"])
    return f"Step {step}/{total}\n{recipe['steps'][step - 1]}"


_TIP_PROMPT = """You are a cooking coach inside a mobile app. You get ONE recipe and a maximum number of tips.
Give a tip ONLY for a step where a mistake is easy to make and would really spoil the dish or be unsafe:
critical heat or timing, something that burns, splits or turns bitter if done wrong, the order of adding things
that matters, food safety. Ordinary steps (chop, mix, serve, stir, wait) get NO tip.
Most recipes need only 0-2 tips. Never fill the maximum just because it is allowed; fewer is better.

Rules:
- Only give a tip when it is important, specific and useful for that step. Do not repeat or rephrase the step.
- Base it on this recipe. Do not invent ingredients or amounts that are not listed.
- One sentence, at most 25 words, plain text, no markdown, no \"Tip:\" prefix.
- If nothing useful applies to a step, leave it out. When in doubt, leave it out.
Return ONLY JSON keyed by step number, with the steps that have a tip, e.g. {\"2\": \"...\", \"5\": \"...\"}.
Return {} if no step needs a tip."""

_tip_cache: dict = {}          # recipe_id -> {step: tip}; ONE LLM call covers every step of a recipe
_TIP_CACHE_MAX = 200
_tip_locks: dict = {}          # recipe_id -> lock, so two quick requests for the same recipe make one call


async def _tips_for_recipe(recipe_id: int, recipe: dict) -> Optional[dict]:
    if recipe_id in _tip_cache:
        return _tip_cache[recipe_id]
    lock = _tip_locks.setdefault(recipe_id, asyncio.Lock())
    async with lock:
        if recipe_id in _tip_cache:
            return _tip_cache[recipe_id]
        steps_block = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(recipe["steps"]))
        total = len(recipe["steps"])
        max_tips = max(1, min(3, total // 4))          # a short recipe gets at most 1, a long one at most 3
        user_block = (
            f"Recipe: {recipe['name']}\n"
            f"Ingredients:\n{format_ingredients(recipe)}\n"
            f"Steps:\n{steps_block}\n\n"
            f"Maximum number of tips: {max_tips}"
        )
        try:
            raw = await execute_groq_request(
                messages=[{"role": "system", "content": _TIP_PROMPT}, {"role": "user", "content": user_block}],
                model=GROQ_LARGE_MODEL,
                response_format={"type": "json_object"},
            )
            data = json.loads(raw)
        except Exception as e:     # a failed tip is simply no tip; cooking must never break because of it
            print(f"[cook] tips failed: {e}")
            return None            # not cached, so a later try can succeed
        tips = {}
        for k, v in (data.items() if isinstance(data, dict) else []):
            if str(k).isdigit() and 1 <= int(k) <= total and isinstance(v, str):
                text = re.sub(r"^\s*tips?\s*:\s*", "", v, flags=re.I).strip()
                if text:
                    tips[int(k)] = text
        tips = dict(sorted(tips.items())[:max_tips])     # hard cap, in case the model ignores the limit
        if len(_tip_cache) >= _TIP_CACHE_MAX:
            _tip_cache.clear()
        _tip_cache[recipe_id] = tips
        return tips


async def tips_for_recipe(recipe_id: int, recipe: dict) -> dict:
    """{step: tip} for the steps that have a tip; {} when none (or anything fails). The app asks once when
    cooking starts and keeps the answer, so the rest of the session needs no LLM call."""
    return await _tips_for_recipe(recipe_id, recipe) or {}


async def answer_question(message: str, recipe: dict, step: int,
                          history: List[ChatMessage]) -> str:
    total = len(recipe["steps"])
    steps_block = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(recipe["steps"]))
    system_prompt = (
        "You are a cooking guide inside a mobile app. The user is cooking ONE recipe and you answer questions "
        "about it.\n"
        f"Recipe: {recipe['name']}\n"
        f"Ingredients:\n{format_ingredients(recipe)}\n"
        f"Steps:\n{steps_block}\n"
        f"The user is currently at step {step} of {total}"
        f"{' (they have not started yet)' if step == 0 else ''}.\n\n"
        "Rules:\n"
        "- Base answers on this recipe. Do not invent steps, ingredients or amounts that are not listed. "
        "If the recipe does not say, say so and give a short, general cooking tip.\n"
        "- Substitutions and timing tips are fine; keep food safety in mind.\n"
        "- Keep it short (1-3 sentences), plain text, no markdown, easy to read on a phone.\n"
        "- If the message is not about this recipe or cooking, say you are in cooking mode and that they can "
        "tap Exit to ask about something else.\n"
        "- Do not move to another step yourself; the user says \"next\" for that."
    )
    messages = [{"role": "system", "content": system_prompt}]
    for chat in history[-6:]:
        messages.append({"role": chat.role, "content": chat.content})
    messages.append({"role": "user", "content": message})
    return await execute_groq_request(messages=messages, model=GROQ_LARGE_MODEL)
