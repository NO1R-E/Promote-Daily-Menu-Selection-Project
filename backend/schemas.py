from enum import Enum
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

class IntentEnum(str, Enum):
    USUAL_CHAT = "usual_chat"
    MEAL_RECOMMENDATION = "meal_recommendation"

class UserMessageRequest(BaseModel):
    user_id: str
    message: str
    room_id: Optional[str] = None

class ClassificationResult(BaseModel):
    intent: IntentEnum
    preferences: List[str] = Field(
        default=[],
        description="Extracted constraints like dietary restrictions, health goals, or specific ingredients."
    )

class MealRecommendation(BaseModel):
    recipe_id: str
    recipe_name: str
    health_score: float
    liking_score: float
    final_score: float
    calories: float
    protein: float
    carb: float
    sodium: float
    sugar: float
    reason: str

class ChatResponse(BaseModel):
    room_id: str
    intent: IntentEnum
    message: str
    recommendations: Optional[List[MealRecommendation]] = None
    
class ChatMessage(BaseModel):
    role: str
    content: str
    
class CachedRecipes(BaseModel):
    recipe_id: str
    recipe_name: str
    nutrients: Dict[str, float] = {}
    tags_fao: Dict[str, float] = {}      
    tags_liking: Dict[str, float] = {}   
    tags_filter: List[str] = []