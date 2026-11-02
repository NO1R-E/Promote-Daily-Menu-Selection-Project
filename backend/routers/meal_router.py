from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from services.meal_service import recommend_one
from services.meal_utils import infer_meal_type
from services.supabase_service import log_impressions

router = APIRouter(prefix="/api/meal")


class AnotherRequest(BaseModel):
    user_id: str
    meal_type: Optional[str] = None
    seen_ids: List[int] = []
    preferences: List[str] = []


@router.post("/another")
async def another(req: AnotherRequest, background_tasks: BackgroundTasks):
    meal = await recommend_one(
        req.user_id, infer_meal_type(req.meal_type), req.preferences, req.seen_ids
    )
    if meal:
        background_tasks.add_task(log_impressions, req.user_id, [meal.recipe_id], "chat")
    return {"meal": meal}