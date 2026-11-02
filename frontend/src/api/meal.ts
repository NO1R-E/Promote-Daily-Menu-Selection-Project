import { MealRecommendation } from "../types/ChatType";
import { postJson } from "./plan";

export function anotherMeal(args: {
  userId: string;
  mealType: string | null;
  seenIds: number[];
  preferences: string[];
}): Promise<MealRecommendation | null> {
  return postJson<{ meal: MealRecommendation | null }>("/api/meal/another", {
    user_id: args.userId,
    meal_type: args.mealType,
    seen_ids: args.seenIds,
    preferences: args.preferences,
  }).then((r) => r.meal);
}