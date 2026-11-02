import { supabase } from "@/src/config/supabase";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export type TodayLog = {
  record_item_id: string;
  recipe_id: number;
  meal_type: MealType | null;
};

// ค่าเริ่มต้นของตัวเลือก: เดาจากเวลา ถ้ามื้อนั้นวันนี้บันทึกไปแล้ว ให้เป็นของว่าง
// (เช้า/กลางวัน/เย็นครบแล้ว การบันทึกถัดไปจึงเป็นของว่างเสมอ)
export function suggestMealType(loggedTypes: Set<string>): MealType {
  const h = new Date().getHours();
  const byTime: MealType =
    h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 17 ? "snack" : h < 22 ? "dinner" : "snack";
  return loggedTypes.has(byTime) ? "snack" : byTime;
}

export async function fetchTodayLogs(userId: string, date: string): Promise<TodayLog[]> {
  const { data, error } = await supabase
    .from("record_item")
    .select("record_item_id, recipe_id, meal_type")
    .eq("user_id", userId)
    .eq("record_date", date);
  if (error) throw error;
  return (data ?? []) as TodayLog[];
}

// วัน + มื้อ + สูตรเดียวกันมีอยู่แล้ว ใช้อันเดิม ไม่เพิ่มซ้ำ
export async function logMeal(
  userId: string,
  recipeId: number,
  mealType: MealType,
  date: string,
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("record_item")
    .select("record_item_id")
    .eq("user_id", userId)
    .eq("record_date", date)
    .eq("meal_type", mealType)
    .eq("recipe_id", recipeId)
    .limit(1);
  if (findError) throw findError;
  if (existing && existing.length > 0) return existing[0].record_item_id;

  const { data, error } = await supabase
    .from("record_item")
    .insert({ user_id: userId, recipe_id: recipeId, meal_type: mealType, record_date: date })
    .select("record_item_id")
    .single();
  if (error) throw error;
  return data.record_item_id;
}

export async function undoLog(recordId: string): Promise<void> {
  const { error } = await supabase.from("record_item").delete().eq("record_item_id", recordId);
  if (error) throw error;
}