import { supabase } from "@/src/config/supabase";
import { Slot } from "@/src/types/PlanType";

export type PlanRow = {
  meal_type: Slot;
  recipe_id: number;
  recipe_name: string | null;
  calories: number | null;
  protein: number | null;
  eaten: boolean;
  record_item_id: string | null;
};

export async function fetchDayPlan(date: string): Promise<Partial<Record<Slot, PlanRow>>> {
  const { data, error } = await supabase.rpc("get_day_plan", { p_date: date });
  if (error) throw error;
  const plan: Partial<Record<Slot, PlanRow>> = {};
  ((data as PlanRow[] | null) ?? []).forEach((row) => {
    plan[row.meal_type] = row;
  });
  return plan;
}

export async function setPlanItem(date: string, slot: Slot, recipeId: number) {
  const { error } = await supabase.rpc("set_plan_item", {
    p_date: date,
    p_meal_type: slot,
    p_recipe_id: recipeId,
  });
  if (error) throw error;
}

export async function clearPlanItem(date: string, slot: Slot) {
  const { error } = await supabase.rpc("clear_plan_item", {
    p_date: date,
    p_meal_type: slot,
  });
  if (error) throw error;
}