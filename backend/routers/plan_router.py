from typing import Dict, List, Literal

from fastapi import APIRouter
from pydantic import BaseModel

from services.plan_service import generate_plan, reroll_slot

router = APIRouter(prefix="/api/plan")


class GenerateRequest(BaseModel):
    user_id: str
    preferences: List[str] = []


class RerollRequest(BaseModel):
    user_id: str
    slot: Literal["breakfast", "lunch", "dinner"]
    current: Dict[str, int] = {}
    seen_ids: List[int] = []           
    preferences: List[str] = []


@router.post("/generate")
async def generate(req: GenerateRequest):
    return {"plan": await generate_plan(req.user_id, req.preferences)}


@router.post("/reroll")
async def reroll(req: RerollRequest):
    return {"meal": await reroll_slot(req.user_id, req.slot, req.current, req.seen_ids, req.preferences)}