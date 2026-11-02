from typing import Dict, Iterable, List

PREFERENCE_WEIGHTS: Dict[str, Dict[str, float]] = {
    "low_sodium":      {"Sodium": 2.5},
    "low_sugar":       {"Sugar": 2.5},
    "high_protein":    {"Protein": 2.0},
    "low_fat":         {"TotalFat": 2.0, "SaturatedFat": 2.5},
    "low_cholesterol": {"Cholesterol": 2.5},
    "high_fiber":      {"Fiber": 2.5},
}

# stop LLM gen preference wrong
def clean_preferences(raw: Iterable[str]) -> List[str]:
    cleaned: List[str] = []
    for item in raw or []:
        key = str(item).strip().lower().replace(" ", "_")
        if key in PREFERENCE_WEIGHTS and key not in cleaned:
            cleaned.append(key)
    return cleaned

# combine preferences if there are more than one, take the hihest wiehgt
def preferences_to_weights(prefs: Iterable[str]) -> Dict[str, float]:
    weights: Dict[str, float] = {}
    for key in clean_preferences(prefs):
        for nutrient, w in PREFERENCE_WEIGHTS[key].items():
            weights[nutrient] = max(weights.get(nutrient, 0.0), w)
    return weights