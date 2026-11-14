from typing import Dict, Iterable, List

# Weights are the SQL base weight x2 (more important) or /2 (less important).
# low_* of a "lower is better" nutrient and high_* of a "higher is better" one are x2; the opposite direction is /2.
PREFERENCE_WEIGHTS: Dict[str, Dict[str, float]] = {
    "low_sodium":       {"Sodium": 2.0},
    "high_sodium":      {"Sodium": 0.5},
    "low_sugar":        {"Sugar": 2.2},
    "high_sugar":       {"Sugar": 0.55},
    "low_fat":          {"TotalFat": 2.2, "SaturatedFat": 3.4},
    "high_fat":         {"TotalFat": 0.55, "SaturatedFat": 0.85},
    "low_cholesterol":  {"Cholesterol": 2.4},
    "high_cholesterol": {"Cholesterol": 0.6},
    "high_protein":     {"Protein": 2.0},
    "low_protein":      {"Protein": 0.5},
    "high_fiber":       {"Fiber": 3.0},
    "low_fiber":        {"Fiber": 0.75},
}

def clean_preferences(raw: Iterable[str]) -> List[str]:
    cleaned: List[str] = []
    for item in raw or []:
        key = str(item).strip().lower().replace(" ", "_")
        if key in PREFERENCE_WEIGHTS and key not in cleaned:
            cleaned.append(key)
    return cleaned

def preferences_to_weights(prefs: Iterable[str]) -> Dict[str, float]:
    weights: Dict[str, float] = {}
    for key in clean_preferences(prefs):
        for nutrient, w in PREFERENCE_WEIGHTS[key].items():
            weights[nutrient] = max(weights.get(nutrient, 0.0), w)
    return weights