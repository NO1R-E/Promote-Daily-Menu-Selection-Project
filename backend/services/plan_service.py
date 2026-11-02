import asyncio
from typing import Dict, List, Optional

from services.dss_service import calculate_meal_recommendations
from services.supabase_service import log_impressions, supabase

SLOT_ORDER = ["breakfast", "lunch", "dinner"]
DEFAULT_SHARES = {"breakfast": 30, "lunch": 40, "dinner": 30}
FALLBACK_TARGET = (2000.0, 50.0)


async def _daily_target(user_id: str) -> tuple:
    res = await asyncio.to_thread(lambda: supabase.table("user_daily_targets")
        .select("kcal, protein_g").eq("user_id", user_id).limit(1).execute())
    if res.data:
        return float(res.data[0]["kcal"]), float(res.data[0]["protein_g"])
    return FALLBACK_TARGET


async def _shares(user_id: str) -> Dict[str, int]:
    res = await asyncio.to_thread(lambda: supabase.table("personalData")
        .select("breakfast_pct, lunch_pct, dinner_pct").eq("personal_id", user_id).limit(1).execute())
    row = res.data[0] if res.data else {}
    return {s: (row.get(f"{s}_pct") if row.get(f"{s}_pct") is not None else DEFAULT_SHARES[s])
            for s in SLOT_ORDER}


async def generate_plan(user_id: str, preferences=()) -> Dict[str, object]:
    kcal, protein = await _daily_target(user_id)
    shares = await _shares(user_id)
    plan, picked = {}, []
    for slot in SLOT_ORDER:
        pct = shares[slot]
        if pct <= 0:
            continue
        recs = await calculate_meal_recommendations(
            user_id, preferences, top_k=1, meal_type=slot,
            target_kcal=kcal * pct / 100, target_protein=protein * pct / 100,
            other_ids=picked)
        if recs:
            plan[slot] = recs[0]
            picked.append(recs[0].recipe_id)
    await log_impressions(user_id, picked, "plan")
    return plan


async def reroll_slot(user_id: str, slot: str, current: Dict[str, int],
                      seen_ids: List[int], preferences=()) -> Optional[object]:
    kcal, protein = await _daily_target(user_id)
    pct = (await _shares(user_id))[slot]
    recs = await calculate_meal_recommendations(
        user_id, preferences, top_k=1, meal_type=slot,
        target_kcal=kcal * pct / 100, target_protein=protein * pct / 100,
        exclude_ids=seen_ids,
        other_ids=[rid for s, rid in current.items() if s != slot])
    if recs:
        await log_impressions(user_id, [recs[0].recipe_id], "reroll")
    return recs[0] if recs else None

async def slot_target(user_id: str, slot: str):
    daily = await _daily_target(user_id)
    if daily is None:
        return None, None
    pct = (await _shares(user_id)).get(slot, 0)
    if pct <= 0:
        return None, None
    return daily[0] * pct / 100, daily[1] * pct / 100