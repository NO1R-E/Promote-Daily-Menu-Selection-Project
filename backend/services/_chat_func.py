from fastapi import BackgroundTasks
from typing import Optional
from schemas import ChatResponse, IntentEnum
from services.groq_service import classify_intent, generate_usual_chat
from services.dss_service import calculate_meal_recommendations
from services.supabase_service import fetch_recent_history, save_chat_turn, get_or_create_room

async def handle_chat_flow(
    user_id: str, 
    room_id: Optional[str], 
    message: str, 
    background_tasks: BackgroundTasks
) -> ChatResponse:
    
    active_room_id = await get_or_create_room(user_id, room_id, message)
    history = await fetch_recent_history(room_id=room_id, limit=8)
    classification = await classify_intent(message, history)
    
    if classification.intent == IntentEnum.MEAL_RECOMMENDATION:
        meals = await calculate_meal_recommendations(user_id, classification.preferences)
        response_msg = "Here are top recommendations:" if meals else "No matching meals found."
        
        response = ChatResponse(
            room_id=active_room_id,
            intent=classification.intent,
            message=response_msg,
            recommendations=meals or []
        )
    else:
        chat_reply = await generate_usual_chat(message, history)
        response = ChatResponse(
            room_id=active_room_id,
            intent=IntentEnum.USUAL_CHAT,
            message=chat_reply
        )

    background_tasks.add_task(save_chat_turn, active_room_id, message, response)

    return response