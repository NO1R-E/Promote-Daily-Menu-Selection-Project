import { supabase } from "@/src/config/supabase";

// Units the user can pick. Everything is converted to grams before saving.
export type Unit = "g" | "kg" | "oz" | "lb" | "ml" | "l" | "tsp" | "tbsp" | "cup";

export const UNITS: { unit: Unit; label: string }[] = [
  { unit: "g", label: "g" },
  { unit: "kg", label: "kg" },
  { unit: "oz", label: "oz" },
  { unit: "lb", label: "lb" },
  { unit: "ml", label: "ml" },
  { unit: "l", label: "L" },
  { unit: "tsp", label: "tsp" },
  { unit: "tbsp", label: "tbsp" },
  { unit: "cup", label: "cup" },
];

// weight units -> grams (exact)
const WEIGHT_G: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
// volume units -> millilitres
const VOLUME_ML: Partial<Record<Unit, number>> = { ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 240 };

export const isVolume = (u: Unit) => VOLUME_ML[u] !== undefined;

// density in g/ml; volume amounts are multiplied by it (1 = water-like when unknown)
export function toGrams(amount: number, unit: Unit, density = 1): number {
  if (!(amount > 0)) return 0;
  const w = WEIGHT_G[unit];
  if (w !== undefined) return amount * w;
  return amount * (VOLUME_ML[unit] ?? 1) * density;
}

// Density comes from the "density" nutrient (g/mL) when the ingredient has it
let densityNutrientId: number | null | undefined;
export async function fetchDensity(ingredientId: number): Promise<number> {
  try {
    if (densityNutrientId === undefined) {
      const { data } = await supabase
        .from("nutrients")
        .select("nutrient_id")
        .eq("nutrient_name", "density")
        .maybeSingle();
      densityNutrientId = data?.nutrient_id ?? null;
    }
    if (densityNutrientId === null) return 1;
    const { data } = await supabase
      .from("ingredient_nutrients")
      .select("amount")
      .eq("ingredient_id", ingredientId)
      .eq("nutrient_id", densityNutrientId)
      .limit(1);
    const d = Number(data?.[0]?.amount);
    return d > 0.05 && d < 5 ? d : 1;
  } catch {
    return 1;
  }
}