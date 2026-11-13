from fastapi import BackgroundTasks
from typing import Optional
from services.meal_service import recommend_one
from services.meal_utils import infer_meal_type
from services.plan_service import generate_plan, slot_target
from schemas import ChatResponse, IntentEnum, CookingState
from services import cook_service
from services.help_text import canned_reply, unclear_reply
from services.groq_service import classify_intent, generate_usual_chat
from services.dss_service import calculate_meal_recommendations
from services.supabase_service import fetch_recent_history, save_chat_turn, get_or_create_room, log_impressions, fetch_focus_tags, fetch_cook_recipe

async def handle_cooking_flow(active_room_id: str, message: str, cooking: CookingState,
                              background_tasks: BackgroundTasks) -> ChatResponse:
    """Cooking mode: every other chat feature is off, the message is about the recipe being cooked."""
    def reply(text: str, step: Optional[int] = None, ended: bool = False) -> ChatResponse:
        # stored as usual_chat: the chat_intent enum has no cooking value
        return ChatResponse(room_id=active_room_id, intent=IntentEnum.USUAL_CHAT, message=text,
                            cooking=None if ended else CookingState(recipe_id=cooking.recipe_id, step=step or 0),
                            cooking_ended=ended)

    try:
        recipe = await fetch_cook_recipe(cooking.recipe_id)
    except Exception as e:      # temporary database problem: stay in cooking mode at the same step
        print(f"[cook] recipe lookup failed: {e}")
        response = reply("Sorry, I couldn't load the recipe just now. Please try again.", cooking.step)
        background_tasks.add_task(save_chat_turn, active_room_id, message, response)
        return response

    if recipe is None:
        response = reply("This recipe isn't available any more, so I turned cooking mode off.", ended=True)
    elif not recipe["steps"]:
        response = reply(f"{recipe['name']} has no step-by-step instructions yet, so I can't guide you through it. "
                         "Cooking mode is off.", ended=True)
    else:
        total = len(recipe["steps"])
        step = min(cooking.step, total)
        action, n = await cook_service.classify_cook_message(message, step, total)
        print(f"[cook] recipe={cooking.recipe_id} step={step}/{total} action={action} n={n}")

        if action == "exit":
            response = reply("Cooking mode is off. Ask me for a meal idea or a plan any time.", ended=True)
        elif action == "help":
            response = reply(cook_service.COOK_HELP, step)
        elif action == "ingredients":
            response = reply(f"Ingredients for {recipe['name']}:\n{cook_service.format_ingredients(recipe)}", step)
        elif action == "start":                       # opening message: ingredients first, step 1 on "next"
            response = reply(cook_service.intro_text(recipe) if step == 0 else cook_service.step_text(recipe, 1),
                             step if step == 0 else 1)
        elif action == "next":
            if step >= total:
                response = reply(f"That was the last step. Enjoy your {recipe['name']}! Cooking mode is off.", ended=True)
            else:
                response = reply(cook_service.step_text(recipe, step + 1), step + 1)
        elif action == "back":
            if step <= 1:
                response = reply(cook_service.intro_text(recipe) if step == 0 else
                                 "This is the first step.\n" + cook_service.step_text(recipe, 1), step)
            else:
                response = reply(cook_service.step_text(recipe, step - 1), step - 1)
        elif action == "repeat":
            response = reply(cook_service.intro_text(recipe) if step == 0 else cook_service.step_text(recipe, step), step)
        elif action == "goto":
            if n is not None and 1 <= n <= total:
                response = reply(cook_service.step_text(recipe, n), n)
            else:
                response = reply(f"This recipe has steps 1 to {total}. Which one do you want?", step)
        else:                                          # question about the recipe
            history = await fetch_recent_history(room_id=active_room_id, limit=6)
            answer = await cook_service.answer_question(message, recipe, step, history)
            response = reply(answer, step)

    background_tasks.add_task(save_chat_turn, active_room_id, message, response)
    return response

async def handle_chat_flow(user_id: str, room_id: Optional[str], message: str,
                           background_tasks: BackgroundTasks,
                           cooking: Optional[CookingState] = None) -> ChatResponse:
    active_room_id = await get_or_create_room(user_id, room_id, message)

    if cooking is not None:
        return await handle_cooking_flow(active_room_id, message, cooking, background_tasks)

    canned = canned_reply(message)
    if canned:
        print(f"[chat] canned reply for: {message[:40]!r}")
        response = ChatResponse(room_id=active_room_id, intent=IntentEnum.USUAL_CHAT, message=canned)
        background_tasks.add_task(save_chat_turn, active_room_id, message, response)
        return response

    history = await fetch_recent_history(room_id=active_room_id, limit=8)   # เดิมใช้ room_id ซึ่งเป็น None ในข้อความแรกของห้องใหม่
    focus_options = await fetch_focus_tags()
    classification = await classify_intent(message, history, focus_options)
    focus_name = next((t["name"] for t in focus_options if t["id"] == classification.focus_tag), None)
    print(f"[chat] intent={classification.intent} meal_type={classification.meal_type} "
          f"prefs={classification.preferences} focus={classification.focus_tag} ({focus_name})")

    if classification.intent == IntentEnum.MEAL_PLAN:
        plan = await generate_plan(user_id, classification.preferences,
                                   focus_tag=classification.focus_tag, focus_name=focus_name)
        meals = list(plan.values())
        response = ChatResponse(
            room_id=active_room_id, intent=classification.intent,
            message="Here's a plan for today:" if meals else "I couldn't build a plan right now.",
            recommendations=meals)

    elif classification.intent == IntentEnum.MEAL_RECOMMENDATION:
        meal_type = infer_meal_type(classification.meal_type)
        meal = await recommend_one(user_id, meal_type, classification.preferences, relax=False,
                                   focus_tag=classification.focus_tag, focus_name=focus_name)
        meals = [meal] if meal else []
        if meal:
            background_tasks.add_task(log_impressions, user_id, [meal.recipe_id], "chat")
        response = ChatResponse(
            room_id=active_room_id,
            intent=classification.intent,
            message=(
                f"Here's a {meal_type} idea:" if meal
                else f"No more {focus_name} meals right now. You've already seen the ones that fit, so try again later or ask for something different." if focus_name
                else "No more matching recipes right now. You've already seen the ones that fit, so try again later or ask for a different meal."
            ),
            recommendations=meals,
        )

    else:
        if classification.intent == IntentEnum.UNCLEAR:      # the classifier couldn't make sense of it
            chat_reply = unclear_reply(message)
        else:
            chat_reply = await generate_usual_chat(message, history)
        response = ChatResponse(room_id=active_room_id, intent=IntentEnum.USUAL_CHAT, message=chat_reply)

    background_tasks.add_task(save_chat_turn, active_room_id, message, response)
    return response