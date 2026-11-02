export type Slot = "breakfast" | "lunch" | "dinner";
export type Shares = Record<Slot, number>;

export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export const DEFAULT_SHARES: Shares = { breakfast: 30, lunch: 40, dinner: 30 };

export type PlanMeal = {
  recipe_id: number;
  recipe_name: string;
  calories: number;
  protein: number;
  final_score: number;
  meal_type?: string | null;
};

export type Plan = Partial<Record<Slot, PlanMeal>>;