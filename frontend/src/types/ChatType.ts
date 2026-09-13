export type IntentType = "usual_chat" | "meal_recommendation";

export interface MealRecommendation {
  recipe_id: string;
  recipe_name: string;
  health_score: number;
  liking_score: number;
  final_score: number;
  calories: number;
  protein: number;
  carb: number;
  sodium: number;
  sugar: number;
  reason: string;
}

export interface UserMessagePayload {
  user_id: string;
  room_id: string | null;
  message: string;
}

export interface ChatResponse {
  room_id: string;
  intent: IntentType;
  message: string;
  recommendations?: MealRecommendation[];
}

export interface MessageItem {
  id: string;
  sender: "user" | "assistant";
  text: string;
  recommendations?: MealRecommendation[];
}
