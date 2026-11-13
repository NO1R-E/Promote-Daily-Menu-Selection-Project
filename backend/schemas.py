from enum import Enum
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

class IntentEnum(str, Enum):
    USUAL_CHAT = "usual_chat"
    MEAL_RECOMMENDATION = "meal_recommendation"
    MEAL_PLAN = "meal_plan"
    UNCLEAR = "unclear"   # the message makes no sense: answered with predefined text, never stored as an intent

class CookingState(BaseModel):
    recipe_id: int
    step: int = Field(default=0, ge=0, le=50)   # last step shown to the user; 0 = not started

class UserMessageRequest(BaseModel):
    user_id: str
    message: str
    room_id: Optional[str] = None
    cooking: Optional[CookingState] = None      # present while the user is in cooking mode

class ClassificationResult(BaseModel):
    intent: IntentEnum
    meal_type: Optional[str] = None
    focus_tag: Optional[int] = None   # a preference tag (food group / cuisine / flavor / texture) the user asked for
    preferences: List[str] = Field(
        default=[],
        description="Extracted constraints like dietary restrictions, health goals, or specific ingredients."
    )

class MealRecommendation(BaseModel):
    recipe_id: int
    recipe_name: str
    health_score: float
    liking_score: float
    final_score: float
    meal_type: Optional[str] = None
    preferences: List[str] = []
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
    cooking: Optional[CookingState] = None      # the new cooking state to keep (only set in cooking mode)
    cooking_ended: bool = False                 # true when the client should leave cooking mode
    
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