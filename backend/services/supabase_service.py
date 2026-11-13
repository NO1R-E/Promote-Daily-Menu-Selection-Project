import asyncio
from typing import List, Optional, Dict, Set
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from schemas import ChatMessage, ChatResponse, CachedRecipes

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

MEAL_CACHE: List[CachedRecipes] = []

FCD_TO_ELIXIR_MAP = {
    "energy": "Calories",
    "protein": "Protein",
    "sugar": "Sugar",
    "tot_fat": "TotalFat",
    "sat_fat": "SaturatedFat",
    "carbohydrate_available": "Carbohydrate",
    "fiber": "Fiber",
    "sodium": "Sodium",
    "cholesterol": "Cholesterol",
    "vit_a": "VitA",
    "vit_c": "VitC",
    "calcium": "Calcium",
    "iron": "Iron",
    "trans_fat": "TransFat"
}

async def fetch_recent_history(room_id: str, limit: int = 10) -> List[ChatMessage]:
    if room_id :
        try:
            response = (
                supabase.table("chat_messages")
                .select("sender, content")
                .eq("room_id", room_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            
            # Reverse list
            history_rows = reversed(response.data)
            
            return [
                ChatMessage(
                    role="user" if row["sender"] == "user" else "assistant", 
                    content=row["content"]
                ) 
                for row in history_rows
            ]
        except Exception as e:
            print(f"Error fetching chat history from Supabase: {e}")
            return []
    else:
        return []

from datetime import datetime, timezone
from schemas import ChatResponse

async def save_chat_turn(room_id: str, user_message: str, response: ChatResponse):
    try:
        intent_str = response.intent.value if hasattr(response.intent, "value") else str(response.intent)

        metadata = None
        if response.recommendations:
            metadata = {
                "recommendations": [
                    r.model_dump() if hasattr(r, "model_dump") else r 
                    for r in response.recommendations
                ]
            }

        messages_to_insert = [
            {
                "room_id": room_id,
                "sender": "user",
                "content": user_message,
            },
            {
                "room_id": room_id,
                "sender": "assistant",
                "intent": intent_str,
                "content": response.message,
                "metadata": metadata
            }
        ]
        supabase.table("chat_messages").insert(messages_to_insert).execute()
        supabase.table("chat_rooms").update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("room_id", room_id).execute()

    except Exception as e:
        print(f"Failed to save messages to Supabase: {e}")
        
async def get_or_create_room(user_id: str, room_id: Optional[str], initial_message: str) -> str:
    if room_id:
        return room_id

    default_title = initial_message[:25] + "..." if len(initial_message) > 25 else initial_message

    response = (
        supabase.table("chat_rooms")
        .insert({"user_id": user_id, "title": default_title})
        .execute()
    )
    print (response)
    
    return str(response.data[0]["room_id"])


_COOK_CACHE: Dict[int, tuple] = {}     # recipe_id -> (loaded_at, recipe)
_COOK_TTL_S = 120                       # every Next / Back would otherwise cost five database calls


async def fetch_cook_recipe(recipe_id: int) -> Optional[dict]:
    """Recipe data for cooking mode: name, ingredient lines and ordered step texts.
    None when the recipe is gone or has no visible forum post (deleted posts are only hidden).
    Raises when the database can't be reached, so the caller can tell "gone" from "try again".

    Runs on the event-loop thread like save_chat_turn / get_or_create_room: the shared supabase client is not
    thread-safe, and a to_thread call overlapping the background save raised WinError 10035."""
    def _load():
        live = (supabase.table("recipe_forum").select("recipe_id")
                .eq("recipe_id", recipe_id).eq("is_hidden", False).limit(1).execute())
        if not live.data:
            return None
        rec = (supabase.table("recipes").select("recipe_name")
               .eq("recipe_id", recipe_id).limit(1).execute())
        if not rec.data:
            return None
        steps = (supabase.table("recipe_steps").select("step_no, description")
                 .eq("recipe_id", recipe_id).order("step_no").execute())
        ings = (supabase.table("recipe_ingredients")
                .select("weight_g, qty, units(name_en), ingredients(name_en, norm_en)")
                .eq("recipe_id", recipe_id).execute())
        lines = []
        for r in ings.data or []:
            ing = r.get("ingredients") or {}
            name = ing.get("name_en") or ing.get("norm_en")
            if not name:
                continue
            unit = (r.get("units") or {}).get("name_en")
            if r.get("qty") and unit:
                q = r["qty"]
                amount = f"{q:g} {unit}"
            elif r.get("weight_g"):
                amount = f"{round(r['weight_g'])} g"
            else:
                amount = ""
            lines.append(f"{name} - {amount}" if amount else name)
        return {
            "recipe_id": recipe_id,
            "name": rec.data[0]["recipe_name"] or "this recipe",
            "steps": [s["description"].strip() for s in (steps.data or []) if (s.get("description") or "").strip()],
            "ingredients": lines,
        }
    import time
    hit = _COOK_CACHE.get(recipe_id)
    if hit and time.time() - hit[0] < _COOK_TTL_S:
        return hit[1]
    try:
        recipe = _load()
    except Exception as e:
        print(f"fetch_cook_recipe failed, retrying once: {e}")
        await asyncio.sleep(0.3)
        recipe = _load()     # a second failure is raised to the caller
    if recipe is not None:   # "gone" is never cached
        _COOK_CACHE[recipe_id] = (time.time(), recipe)
    else:
        _COOK_CACHE.pop(recipe_id, None)
    return recipe


async def fetch_recipes_cache():
    global MEAL_CACHE
    TestMode = False  # Set to True for testing with a smaller dataset
    try:
        all_rows = []
        page_size = 1000
        start = 0

        while True:
            response = (
                supabase.table("recipe_cache_view")
                .select("*")
                .range(start, start + page_size - 1)
                .execute()
            )
            
            data = response.data
            if not data:
                break

            all_rows.extend(data)
            
            if TestMode or len(data) < page_size:
                break

            start += page_size

        recipes_map: Dict[str, dict] = {}

        for row in all_rows:
            recipe_id = str(row["recipe_id"])
            recipe_name = row["recipe_name"]

            if recipe_id not in recipes_map:
                recipes_map[recipe_id] = {
                    "recipe_id": recipe_id,
                    "recipe_name": recipe_name,
                    "nutrients": {},
                    "fao_counts": {},
                    "liking_counts": {},
                    "filter_tags": set()
                }

            rec = recipes_map[recipe_id]
            weight_g = float(row.get("weight_g") or 100.0)
            weight_factor = weight_g / 100.0

            raw_nut_name = row.get("nutrient_name")
            nut_amount = row.get("nutrient_amount")
            
            if raw_nut_name and nut_amount is not None:
                elixir_key = FCD_TO_ELIXIR_MAP.get(raw_nut_name, raw_nut_name)
                scaled_amount = float(nut_amount) * weight_factor
                rec["nutrients"][elixir_key] = rec["nutrients"].get(elixir_key, 0.0) + scaled_amount

            tag_name = row.get("tag_name")
            tag_cat = row.get("tag_category")
            if tag_name and tag_cat:
                if tag_cat == "FAO":
                    rec["fao_counts"][tag_name] = rec["fao_counts"].get(tag_name, 0) + 1
                elif tag_cat == "LIKING":
                    rec["liking_counts"][tag_name] = rec["liking_counts"].get(tag_name, 0) + 1
                elif tag_cat == "FILTER":
                    rec["filter_tags"].add(tag_name)

        transformed_cache: List[CachedRecipes] = []

        def normalize_vector(counts_dict: Dict[str, int]) -> Dict[str, float]:
            total_count = sum(counts_dict.values())
            if total_count == 0:
                return {}
            return {tag: round(count / total_count, 4) for tag, count in counts_dict.items()}

        for rec in recipes_map.values():
            final_nutrients = {k: round(v, 2) for k, v in rec["nutrients"].items()}
            
            transformed_cache.append(
                CachedRecipes(
                    recipe_id=rec["recipe_id"],
                    recipe_name=rec["recipe_name"],
                    nutrients=final_nutrients,
                    tags_fao=normalize_vector(rec["fao_counts"]),
                    tags_liking=normalize_vector(rec["liking_counts"]),
                    tags_filter=list(rec["filter_tags"])
                )
            )

        if transformed_cache:
            sample_recipe = transformed_cache[0]
            print("DEBUG Sample Cached Recipe Nutrients:", sample_recipe.nutrients)

        MEAL_CACHE.clear()
        MEAL_CACHE.extend(transformed_cache)
        print(f" Successfully loaded ALL {len(MEAL_CACHE)} recipes via Paginated SQL View!")

    except Exception as e:
        print(f"Failed to load recipe cache from Supabase: {e}")
        
async def log_impressions(user_id: str, recipe_ids: list[int], source: str = "chat") -> None:
    if not recipe_ids:
        return
    try:
        await asyncio.to_thread(lambda: supabase.rpc(
            "log_impressions",
            {"p_user_id": user_id, "p_recipe_ids": recipe_ids, "p_source": source},
        ).execute())
    except Exception as e:           # การบันทึกพลาดต้องไม่ทำให้แชตพัง
        print(f"log_impressions failed: {e}")


async def nudge_skip(user_id: str, recipe_id) -> None:
    """The user rerolled / asked for another: push the preference vector slightly away from that recipe."""
    if not recipe_id:
        return
    try:
        await asyncio.to_thread(lambda: supabase.rpc(
            "skip_recommended_meal",
            {"p_user": user_id, "p_recipe_id": int(recipe_id)},
        ).execute())
    except Exception as e:           # a failed nudge must never break the reroll
        print(f"nudge_skip failed: {e}")


_FOCUS_CACHE: dict = {"at": 0.0, "tags": []}
_FOCUS_TTL_S = 600


async def fetch_focus_tags() -> List[dict]:
    """Preference tags (food group, cuisine, flavor, texture) the chat may filter by. Cached for 10 minutes."""
    import time
    if _FOCUS_CACHE["tags"] and time.time() - _FOCUS_CACHE["at"] < _FOCUS_TTL_S:
        return _FOCUS_CACHE["tags"]
    try:
        res = await asyncio.to_thread(lambda: (
            supabase.table("tags")
            .select("tag_id, tag_name, description, tag_groups!inner(group_name, kind)")
            .eq("is_active", True)
            .eq("tag_groups.kind", "preference")
            .execute()))
        tags = []
        for r in res.data or []:
            if r["tag_name"] == "Other":
                continue
            g = r.get("tag_groups") or {}
            if isinstance(g, list):
                g = g[0] if g else {}
            tags.append({
                "id": int(r["tag_id"]),
                "name": r["tag_name"],
                "group": g.get("group_name") or "",
                "description": (r.get("description") or "")[:160],
            })
        _FOCUS_CACHE["tags"], _FOCUS_CACHE["at"] = tags, time.time()
        return tags
    except Exception as e:           # chat must keep working without tag filtering
        print(f"fetch_focus_tags failed: {e}")
        return _FOCUS_CACHE["tags"]