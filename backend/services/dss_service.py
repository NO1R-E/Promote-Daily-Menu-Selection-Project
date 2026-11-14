import asyncio
import random
from typing import Iterable, List, Optional

from schemas import MealRecommendation
from services.preferences import clean_preferences, preferences_to_weights
from services.supabase_service import supabase

MAX_FOCUS_TRIES = 3


async def _rpc(name: str, params: dict):
    res = await asyncio.to_thread(lambda: supabase.rpc(name, params).execute())
    return res.data


async def _liked_main_tags(user_id: str) -> list:
    tags = await _rpc("liked_main_tags", {"p_user_id": user_id}) or []
    return sorted(tags, key=lambda t: random.expovariate(t["weight"]))


async def _recent_ids(user_id: str) -> List[int]:
    return await _rpc("excluded_recipe_ids", {"p_user_id": user_id}) or []


async def calculate_meal_recommendations(
    user_id: str,
    preferences: Iterable[str],
    top_k: int = 1,
    exclude_ids: Optional[List[int]] = None,
    meal_type: Optional[str] = None,
    target_kcal: Optional[float] = None,
    target_protein: Optional[float] = None,
    other_ids: Optional[List[int]] = None,
    rotate: bool = True,
    focus_tag: Optional[int] = None,     # a tag the user explicitly asked for: used as is, no random rotation, no fallback
    focus_name: Optional[str] = None,
    relax: bool = True,         # False = never drop the exclusion list: say "no more" instead of repeating a recent meal
) -> List[MealRecommendation]:
    prefs = clean_preferences(preferences)
    weights = preferences_to_weights(prefs)
    session_exclude = list(exclude_ids or [])

    def params(exclude: List[int], focus_tag: Optional[int]) -> dict:
        return {
            "p_weights": weights, "p_top_k": top_k, "p_user_id": user_id,
            "p_exclude": exclude, "p_meal_type": meal_type,
            "p_kcal": target_kcal, "p_protein": target_protein,
            "p_other_ids": other_ids or [], "p_focus_tag": focus_tag,
        }

    recent = await _recent_ids(user_id)
    exclude = sorted(set(session_exclude) | set(recent))

    rows, focus, fallback = [], None, []
    unfiltered_done = False
    requested = focus_tag is not None
    if requested:
        focus = {"tag_id": focus_tag, "tag_name": focus_name or "your request"}
        rows = await _rpc("recommend_meals", params(exclude, focus_tag))
    elif rotate:
        for tag in (await _liked_main_tags(user_id))[:MAX_FOCUS_TRIES]:
            rows = await _rpc("recommend_meals", params(exclude, tag["tag_id"]))
            if rows:
                focus = tag
                break
            if not unfiltered_done:
                unfiltered_done = True
                fallback = await _rpc("recommend_meals", params(exclude, None))
                if not fallback:
                    break
    if not rows and not requested:
        rows = fallback
        if not rows and not unfiltered_done:
            rows = await _rpc("recommend_meals", params(exclude, None))
    if not rows and recent and relax:                         # almost no recipes left -> relax the exclusion list
        rows = await _rpc("recommend_meals", params(session_exclude, focus_tag if requested else None))

    tuned = f", tuned for {', '.join(p.replace('_', ' ') for p in prefs)}" if prefs else ""
    picked = (
        (f" Picked from {focus['tag_name']}, as you asked." if requested
         else f" Picked from {focus['tag_name']}, which you like.")
        if focus else ""
    )

    results: List[MealRecommendation] = []
    for r in rows or []:
        if target_kcal and meal_type:
            pct = round(100 * r["calories"] / target_kcal)
            reason = f"About {pct}% of your {meal_type} calorie target ({round(target_kcal)} kcal){tuned}.{picked}"
        else:
            reason = f"Top nutritional match with an ELIXIR Health Score of {r['health_score']}{tuned}.{picked}"
        results.append(
            MealRecommendation(
                recipe_id=r["recipe_id"],
                recipe_name=r["recipe_name"],
                health_score=r["health_score"],
                liking_score=r["liking_score"],
                final_score=r["final_score"],
                novelty_score=round(r.get("novelty_score") if r.get("novelty_score") is not None else 1.0, 3),
                fit_score=round(r.get("meal_fit") if r.get("meal_fit") is not None else 1.0, 3),
                calories=round(r["calories"]),
                protein=round(r["protein"], 1),
                carb=round(r["carb"], 1),
                sodium=round(r["sodium"]),
                sugar=round(r["sugar"], 1),
                reason=reason,
                meal_type=meal_type,
                preferences=prefs,
            )
        )
    print(
        f"[dss] user={user_id[:8]} slot={meal_type} exclude={len(exclude)} (recent={len(recent)}) "
        f"focus={focus['tag_name'] if focus else None} relax={relax} -> {len(results)} result(s)"
    )
    for x in results:
        print(
            f"[dss]   #{x.recipe_id} {x.recipe_name!r}: health={x.health_score} "
            f"liking={x.liking_score} novelty={x.novelty_score} fit={x.fit_score} "
            f"final={x.final_score} kcal={x.calories} protein={x.protein}"
        )
    return results