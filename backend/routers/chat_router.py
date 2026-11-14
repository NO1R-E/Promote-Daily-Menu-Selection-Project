from fastapi import APIRouter, BackgroundTasks, HTTPException
from schemas import UserMessageRequest, ChatResponse, CookTipsRequest, CookTipsResponse
from services._chat_func import handle_chat_flow
from services import cook_service
from services.supabase_service import fetch_cook_recipe

router = APIRouter(prefix="/api", tags=["Chat"])

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: UserMessageRequest, 
    background_tasks: BackgroundTasks
):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        return await handle_chat_flow(
            user_id=request.user_id,
            room_id=request.room_id,
            message=request.message,
            background_tasks=background_tasks,
            cooking=request.cooking
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat execution failed: {str(e)}")


@router.post("/cook/tips", response_model=CookTipsResponse)
async def cook_tips_endpoint(request: CookTipsRequest):
    """All tips of one recipe, from a single LLM call. The app asks once when cooking starts and keeps them.
    Any failure just means 'no tips'."""
    try:
        recipe = await fetch_cook_recipe(request.recipe_id)
        if not recipe or not recipe["steps"]:
            return CookTipsResponse(tips={})
        tips = await cook_service.tips_for_recipe(request.recipe_id, recipe)
        return CookTipsResponse(tips={str(k): v for k, v in tips.items()})
    except Exception as e:
        print(f"[cook] tips endpoint failed: {e}")
        return CookTipsResponse(tips={})
