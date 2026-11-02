from fastapi import BackgroundTasks
from typing import Optional
from services.meal_service import recommend_one
from services.meal_utils import infer_meal_type
from services.plan_service import generate_plan, slot_target
from schemas import ChatResponse, IntentEnum
from services.groq_service import classify_intent, generate_usual_chat
from services.dss_service import calculate_meal_recommendations
from services.supabase_service import fetch_recent_history, save_chat_turn, get_or_create_room, log_impressions

async def handle_chat_flow(user_id: str, room_id: Optional[str], message: str,
                           background_tasks: BackgroundTasks) -> ChatResponse:
    active_room_id = await get_or_create_room(user_id, room_id, message)
    history = await fetch_recent_history(room_id=active_room_id, limit=8)   # เดิมใช้ room_id ซึ่งเป็น None ในข้อความแรกของห้องใหม่
    classification = await classify_intent(message, history)

    if classification.intent == IntentEnum.MEAL_PLAN:
        plan = await generate_plan(user_id, classification.preferences)
        meals = list(plan.values())
        response = ChatResponse(
            room_id=active_room_id, intent=classification.intent,
            message="Here's a plan for today:" if meals else "I couldn't build a plan right now.",
            recommendations=meals)

    elif classification.intent == IntentEnum.MEAL_RECOMMENDATION:
        meal_type = infer_meal_type(classification.meal_type)
        meal = await recommend_one(user_id, meal_type, classification.preferences)
        meals = [meal] if meal else []
        if meal:
            background_tasks.add_task(log_impressions, user_id, [meal.recipe_id], "chat")
        response = ChatResponse(
            room_id=active_room_id,
            intent=classification.intent,
            message=f"Here's a {meal_type} idea:" if meal else "No matching meals found.",
            recommendations=meals,
        )

    else:
        chat_reply = await generate_usual_chat(message, history)
        response = ChatResponse(room_id=active_room_id, intent=IntentEnum.USUAL_CHAT, message=chat_reply)

    background_tasks.add_task(save_chat_turn, active_room_id, message, response)
    return response