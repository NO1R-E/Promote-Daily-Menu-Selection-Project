from typing import Optional

from fastapi import BackgroundTasks

from schemas import ChatResponse, CookingState, IntentEnum
from services import cook_service
from services.supabase_service import fetch_cook_recipe, fetch_recent_history, save_chat_turn


def _response(room_id: str, cooking: CookingState, text: str, step: Optional[int] = None,
              ended: bool = False) -> ChatResponse:
    return ChatResponse(room_id=room_id, intent=IntentEnum.USUAL_CHAT, message=text,
                        cooking=None if ended else CookingState(recipe_id=cooking.recipe_id, step=step or 0),
                        cooking_ended=ended)


async def _answer(room_id: str, message: str, cooking: CookingState) -> ChatResponse:
    try:
        recipe = await fetch_cook_recipe(cooking.recipe_id)
    except Exception as e:
        print(f"[cook] recipe lookup failed: {e}")
        return _response(room_id, cooking, "Sorry, I couldn't load the recipe just now. Please try again.",
                         cooking.step)

    if recipe is None:
        return _response(room_id, cooking, "This recipe isn't available any more, so I turned cooking mode off.",
                         ended=True)
    if not recipe["steps"]:
        return _response(room_id, cooking,
                         f"{recipe['name']} has no step-by-step instructions yet, so I can't guide you through it. "
                         "Cooking mode is off.", ended=True)

    total = len(recipe["steps"])
    step = min(cooking.step, total)
    action, n = await cook_service.classify_cook_message(message, step, total)
    print(f"[cook] recipe={cooking.recipe_id} step={step}/{total} action={action} n={n}")

    nav = cook_service.navigate(action, n, recipe, step)
    if nav is not None:
        text, new_step, ended = nav
        return _response(room_id, cooking, text, new_step, ended)

    history = await fetch_recent_history(room_id=room_id, limit=6)
    answer = await cook_service.answer_question(message, recipe, step, history)
    return _response(room_id, cooking, answer, step)


async def handle_cooking_flow(active_room_id: str, message: str, cooking: CookingState,
                              background_tasks: BackgroundTasks) -> ChatResponse:
    response = await _answer(active_room_id, message, cooking)
    background_tasks.add_task(save_chat_turn, active_room_id, message, response)
    return response
