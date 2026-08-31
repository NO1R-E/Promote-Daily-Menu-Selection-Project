from typing import List, Dict
from schemas import UserMessageRequest, ClassificationResult, MealRecommendation, CachedRecipes
from services.supabase_service import MEAL_CACHE

# Base Reference Daily Values (DV)
DV = {
    "Calories": 2000.0,
    "Protein": 50.0,
    "Sugar": 50.0,
    "TotalFat": 60.0,
    "SaturatedFat": 20.0,
    "Carbohydrate": 300.0,
    "Fiber": 25.0,
    "Sodium": 2400.0,
    "Cholesterol": 300.0,
    "VitA": 5000.0,
    "VitC": 60.0,
    "Calcium": 1000.0,
    "Iron": 18.0
}

# Base Health Score Weights
DEFAULT_WEIGHTS = {
    "Calories": 1.00,
    "Protein": 1.00,
    "Sugar": 1.10,
    "TotalFat": 1.10,
    "SaturatedFat": 1.70,
    "Carbohydrate": 1.00,
    "Fiber": 1.50,
    "Sodium": 1.00,
    "Cholesterol": 1.20,
    "VitA": 1.00,
    "VitC": 1.00,
    "Calcium": 1.00,
    "Iron": 1.00,
    "TransFat": 0.91,
    "ComplexCarb": 0.10
}

# Rule-based are here
def get_dynamic_weights(preferences: ClassificationResult) -> Dict[str, float]:
    weights = DEFAULT_WEIGHTS.copy()

    if not preferences:
        return weights

    # temp
    if getattr(preferences, "low_salt", False) or "low_sodium" in getattr(preferences, "tags", []):
        weights["Sodium"] = 2.50

    if getattr(preferences, "low_sugar", False) or "diabetic" in getattr(preferences, "tags", []):
        weights["Sugar"] = 2.50

    if getattr(preferences, "high_protein", False):
        weights["Protein"] = 2.00

    return weights


def calculate_elixir_score(nutrients: Dict[str, float], weights: Dict[str, float], mult: float = 1.0) -> float:
    dish = {
        "Calories": nutrients.get("Calories", 0.0),
        "Protein": nutrients.get("Protein", 0.0),
        "Sugar": nutrients.get("Sugar", 0.0),
        "TotalFat": nutrients.get("TotalFat", 0.0),
        "SaturatedFat": nutrients.get("SaturatedFat", 0.0),
        "Carbohydrate": nutrients.get("Carbohydrate", 0.0),
        "Fiber": nutrients.get("Fiber", 0.0),
        "Sodium": nutrients.get("Sodium", 0.0),
        "Cholesterol": nutrients.get("Cholesterol", 0.0),
        "VitA": nutrients.get("VitA", 0.0),
        "VitC": nutrients.get("VitC", 0.0),
        "Calcium": nutrients.get("Calcium", 0.0),
        "Iron": nutrients.get("Iron", 0.0),
        "TransFat": nutrients.get("TransFat", 0.0)
    }

    carb = max(dish["Carbohydrate"], 0.001)
    total_fat = max(dish["TotalFat"], 0.001)

    rec_base = weights["Protein"] * (dish["Protein"] / DV["Protein"])
    fiber_term = weights["Fiber"] * (dish["Fiber"] / carb)
    complex_carb_numerator = carb - dish["Fiber"] - dish["Sugar"]
    complex_carb_term = weights["ComplexCarb"] * (max(0.0, complex_carb_numerator) / carb)
    rec_base = rec_base + fiber_term + complex_carb_term

    rec_add = (
        weights["VitA"] * (dish["VitA"] / DV["VitA"]) +
        weights["VitC"] * (dish["VitC"] / DV["VitC"]) +
        weights["Calcium"] * (dish["Calcium"] / DV["Calcium"]) +
        weights["Iron"] * (dish["Iron"] / DV["Iron"])
    )

    rest_base = (
        weights["Calories"] * (dish["Calories"] / DV["Calories"]) +
        weights["Cholesterol"] * (dish["Cholesterol"] / DV["Cholesterol"]) +
        weights["Sodium"] * (dish["Sodium"] / DV["Sodium"]) +
        weights["SaturatedFat"] * (dish["SaturatedFat"] / DV["SaturatedFat"]) +
        weights["TotalFat"] * (dish["TotalFat"] / DV["TotalFat"]) +
        weights["Sugar"] * (dish["Sugar"] / DV["Sugar"])
    )

    sugar_carb_ratio = weights["Carbohydrate"] * (dish["Sugar"] / carb)
    sat_fat_ratio = weights["SaturatedFat"] * (dish["SaturatedFat"] / total_fat)
    trans_fat_term = weights["TransFat"] * dish["TransFat"]

    rest_base = rest_base + sugar_carb_ratio + sat_fat_ratio + trans_fat_term
    rest_base = max(rest_base, 0.001)

    base_elixir = (rec_base + mult * rec_add) / ((1 + mult) * rest_base)

    return round(base_elixir, 4)


async def calculate_meal_recommendations(user_id: UserMessageRequest, preferences: ClassificationResult, top_k: int = 3) -> List[MealRecommendation]:
    if not MEAL_CACHE:
        print("Warning: MEAL_CACHE is empty!")
        return []

    dynamic_weights = get_dynamic_weights(preferences)

    scored_meals = []

    # Calculate scores for each recipe in cache
    for recipe in MEAL_CACHE:
        h_score = calculate_elixir_score(recipe.nutrients, dynamic_weights)
        
        #Temp
        pref_score = h_score
        
        final_score = round((h_score + pref_score) / 2.0, 4)

        scored_meals.append({
            "recipe": recipe,
            "health_score": h_score,
            "liking_score": pref_score,
            "final_score": final_score
        })

    scored_meals.sort(key=lambda x: x["final_score"], reverse=True)

    top_recommendations = scored_meals[:top_k]

    results: List[MealRecommendation] = []
    for item in top_recommendations:
        rec: CachedRecipes = item["recipe"]
        nutrients = rec.nutrients

        results.append(
            MealRecommendation(
                recipe_id=rec.recipe_id,
                recipe_name=rec.recipe_name,
                health_score=item["health_score"],
                liking_score=item["liking_score"],
                final_score=item["final_score"],
                calories=nutrients.get("Calories", 0.0),
                protein=nutrients.get("Protein", 0.0),
                carb=nutrients.get("Carbohydrate", 0.0),
                sodium=nutrients.get("Sodium", 0.0),
                sugar=nutrients.get("Sugar", 0.0),
                reason=f"Top nutritional match with an ELIXIR Health Score of {item['health_score']}."
            )
        )

    return results