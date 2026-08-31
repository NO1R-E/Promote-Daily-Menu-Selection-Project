from fastapi import APIRouter, BackgroundTasks, HTTPException
from schemas import UserMessageRequest, ChatResponse
from services._chat_func import handle_chat_flow

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
            background_tasks=background_tasks
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat execution failed: {str(e)}")