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


async def fetch_recipes_cache():
    global MEAL_CACHE
    try:
        all_rows = []
        page_size = 1000
        start = 0

        # Loop until all rows are fetched across pages
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
            
            if len(data) < page_size:
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

            # 2. Accumulate nutrients with key translation
            raw_nut_name = row.get("nutrient_name")
            nut_amount = row.get("nutrient_amount")
            
            if raw_nut_name and nut_amount is not None:
                # Map raw key (e.g. 'energy') to ELIXIR key ('Calories')
                elixir_key = FCD_TO_ELIXIR_MAP.get(raw_nut_name, raw_nut_name)
                scaled_amount = float(nut_amount) * weight_factor
                rec["nutrients"][elixir_key] = rec["nutrients"].get(elixir_key, 0.0) + scaled_amount

            # Accumulate tags
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