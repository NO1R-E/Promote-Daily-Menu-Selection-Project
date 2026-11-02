from typing import List, Optional

from schemas import MealRecommendation
from services.dss_service import calculate_meal_recommendations
from services.plan_service import slot_target


async def recommend_one(
    user_id: str, meal_type: str, preferences, exclude_ids: Optional[List[int]] = None
) -> Optional[MealRecommendation]:
    kcal, protein = await slot_target(user_id, meal_type)
    meals = await calculate_meal_recommendations(
        user_id, preferences, top_k=1, exclude_ids=exclude_ids,
        meal_type=meal_type, target_kcal=kcal, target_protein=protein,
    )
    return meals[0] if meals else None