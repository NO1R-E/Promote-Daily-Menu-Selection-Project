import { supabase } from "@/src/config/supabase";

// ---------------------------------------------------------------------------
// Units now live in the database (table "units"):
//   ingredient_id = null  -> universal unit (g, kg, oz, lb, ml, L, tsp, tbsp, cup)
//   ingredient_id = X     -> a unit of ONE ingredient (egg = 50 g, clove = 5 g, ...)
//   kind "weight" / "piece": factor = grams per unit
//   kind "volume"          : factor = millilitres per unit (grams = ml x ingredient density)
// A recipe ingredient is saved as qty + unit_id + weight_g (grams, recomputed on the server).
// ---------------------------------------------------------------------------
export type DbUnit = {
  unit_id: number;
  ingredient_id: number | null;
  name_en: string;
  name_th: string | null;
  kind: "weight" | "volume" | "piece";
  factor: number;
  is_default: boolean;
  created_by: string | null; // who added the unit
  sort_order: number; // shared units: small = listed first (set by units_v3.sql)
};

const UNIT_COLS =
  "unit_id, ingredient_id, name_en, name_th, kind, factor, is_default, created_by, sort_order";

const toDbUnit = (r: any): DbUnit => ({
  unit_id: Number(r.unit_id),
  ingredient_id: r.ingredient_id == null ? null : Number(r.ingredient_id),
  name_en: String(r.name_en),
  name_th: r.name_th ?? null,
  kind: r.kind,
  factor: Number(r.factor),
  is_default: !!r.is_default,
  created_by: r.created_by ?? null,
  sort_order: Number(r.sort_order ?? 1000),
});

// display order of the universal units
const UNIVERSAL_ORDER = ["g", "kg", "oz", "lb", "ml", "L", "tsp", "tbsp", "cup"];

export const unitLabel = (u: DbUnit) => u.name_en;
export const isGramUnit = (u: DbUnit) => u.ingredient_id === null && u.name_en === "g";

// "tbsp (≈14.8 g)" / "egg (50 g)"; plain grams are just "g". Volume units need the ingredient's density.
export function unitWithGrams(u: DbUnit, density = 1): string {
  if (isGramUnit(u)) return "g";
  const g = u.factor * (u.kind === "volume" ? density : 1);
  const r = g >= 100 ? Math.round(g) : Math.round(g * 10) / 10;
  return `${u.name_en} (${u.kind === "volume" ? "≈" : ""}${r} g)`;
}

// grams for `amount` of unit `u` (density in g/ml is only used for volume units)
export function gramsFor(amount: number, u: DbUnit, density = 1): number {
  if (!(amount > 0)) return 0;
  return amount * u.factor * (u.kind === "volume" ? density : 1);
}

// Returns { "<ingredientId>": [own units (default first), then the universal units] } for every id asked for
export async function fetchUnits(
  ingredientIds: number[],
): Promise<Record<string, DbUnit[]>> {
  const ids = Array.from(new Set(ingredientIds.filter((n) => Number.isFinite(n))));
  const out: Record<string, DbUnit[]> = {};
  if (ids.length === 0) return out;

  const { data, error } = await supabase
    .from("units")
    .select(UNIT_COLS)
    .or(`ingredient_id.is.null,ingredient_id.in.(${ids.join(",")})`);
  if (error) throw error;

  const rows: DbUnit[] = (data ?? []).map(toDbUnit);

  const universal = rows
    .filter((u) => u.ingredient_id === null)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en),
    );
  for (const id of ids) {
    const own = rows
      .filter((u) => u.ingredient_id === id)
      .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name_en.localeCompare(b.name_en));
    out[String(id)] = [...own, ...universal];
  }
  return out;
}

// Units of one ingredient only (used by the ingredient form)
export async function fetchOwnUnits(ingredientId: number): Promise<DbUnit[]> {
  const { data, error } = await supabase
    .from("units")
    .select(UNIT_COLS)
    .eq("ingredient_id", ingredientId)
    .order("unit_id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toDbUnit);
}

// ---------------------------------------------------------------------------
// Adding / editing / removing units (any user adds; the creator and admins edit or remove)
// ---------------------------------------------------------------------------
export const UNIT_ERRORS: Record<string, string> = {
  UNIT_INVALID:
    "Use a short name and a weight between 0.1 and 5000 g (or ml for a shared volume unit).",
  UNIT_NAME_DUPLICATE:
    "This ingredient (or the shared list) already has a unit with this name.",
  UNIT_NAME_CONFLICT:
    "Some ingredient already has its own unit with this name. Rename that one first or pick another name.",
  UNIT_IN_USE: "A recipe already uses this unit, so it can't be removed.",
  UNIT_SYSTEM: "This unit is needed by the app. Only its Thai name can change.",
  TOO_MANY_UNITS:
    "An ingredient can have up to 5 special units (admins: up to 8).",
  UNIT_NOT_FOUND: "This unit no longer exists.",
  INGREDIENT_IN_USE:
    "A recipe already uses this ingredient, so its units can no longer be changed.",
  FORBIDDEN:
    "Only the owner of this ingredient (or an admin) can change its units.",
  NOT_AUTHENTICATED: "Please log in again.",
  INGREDIENT_NOT_FOUND: "This ingredient no longer exists.",
};

export const unitErrorMessage = (e: any): string => {
  const text: string = e?.message || "";
  const code = Object.keys(UNIT_ERRORS).find((k) => text.includes(k));
  return code ? UNIT_ERRORS[code] : "Something went wrong. Please try again.";
};

// admins: up to 8 units per ingredient. An owner gets up to 5 (see MAX_UNITS_USER in ingredientForm.tsx).
export const MAX_UNITS_PER_INGREDIENT = 8;

// owner + status of ingredients: units belong to the ingredient, so only its owner (while it is
// unverified) and admins can add / edit / remove them
export type IngredientOwner = { user_id: string | null; status: string };
export async function fetchIngredientOwners(
  ingredientIds: number[],
): Promise<Record<string, IngredientOwner>> {
  const out: Record<string, IngredientOwner> = {};
  if (ingredientIds.length === 0) return out;
  const { data, error } = await supabase
    .from("ingredients")
    .select("ingredient_id, user_id, status")
    .in("ingredient_id", ingredientIds);
  if (error) throw error;
  (data ?? []).forEach((r: any) => {
    out[String(r.ingredient_id)] = { user_id: r.user_id ?? null, status: String(r.status) };
  });
  return out;
}

export async function addIngredientUnit(
  ingredientId: number,
  nameEn: string,
  nameTh: string,
  grams: number,
): Promise<number> {
  const { data, error } = await supabase.rpc("add_ingredient_unit", {
    p_ingredient_id: ingredientId,
    p_name_en: nameEn,
    p_name_th: nameTh.trim() || null,
    p_grams: grams,
  });
  if (error) throw error;
  return Number(data);
}

export async function updateIngredientUnit(
  unitId: number,
  nameEn: string,
  nameTh: string,
  grams: number,
): Promise<void> {
  const { error } = await supabase.rpc("update_ingredient_unit", {
    p_unit_id: unitId,
    p_name_en: nameEn,
    p_name_th: nameTh.trim() || null,
    p_grams: grams,
  });
  if (error) throw error;
}

export async function deleteIngredientUnit(unitId: number): Promise<void> {
  const { error } = await supabase.rpc("delete_ingredient_unit", {
    p_unit_id: unitId,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Old client-side units (kept so nothing else that imports them breaks)
// ---------------------------------------------------------------------------
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
