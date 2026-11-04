import time
from collections import defaultdict, deque
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ingredient_service import MAX_DESCRIPTION, estimate_ingredient

router = APIRouter(prefix="/api/ingredient")

LIMIT_PER_HOUR = 20
_calls = defaultdict(deque)


def _check_rate(user_id: str) -> None:
    now = time.time()
    q = _calls[user_id]
    while q and now - q[0] > 3600:
        q.popleft()
    if len(q) >= LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    q.append(now)


class NutrientItem(BaseModel):
    name: str
    unit: Optional[str] = None


class TagItem(BaseModel):
    id: int
    name: str
    group: Optional[str] = None


class EstimateRequest(BaseModel):
    user_id: str
    description: str = Field(max_length=MAX_DESCRIPTION * 2)
    nutrients: List[NutrientItem] = Field(max_length=80)
    tags: List[TagItem] = Field(max_length=300)


@router.post("/estimate")
async def estimate(req: EstimateRequest):
    _check_rate(req.user_id)
    try:
        return await estimate_ingredient(
            req.description,
            [n.model_dump() for n in req.nutrients],
            [t.model_dump() for t in req.tags],
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError:
        raise HTTPException(status_code=503, detail="AI is busy. Please fill the form manually or retry.")