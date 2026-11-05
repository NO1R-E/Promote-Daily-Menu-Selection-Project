import { supabase } from "@/src/config/supabase";
import { makeIngredientKey } from "@/components/forms/ingredientPickerSheet";
import type { RecipeFormInitial, StepItem } from "@/components/forms/RecipeForm";
import { makeStepId } from "@/components/forms/RecipeForm";

// ---- value your picker uses for the non-user (system) ingredients ----
// Open ingredientPickerSheet.tsx / ingredientCommon.ts, find the source union
// (e.g. "system" | "user") and make sure this matches, otherwise an ingredient
// that is already in the recipe will not show as "selected" in the picker.
const SYSTEM_SOURCE = "system";

// tags.group_id of the Cuisine / Culture group
const CUISINE_GROUP = 8;

export type DetailStep = { step_no: number; description: string; img: string[] };
export type DetailIngredient = {
  ingredient_id: number;
  name: string;
  weight_g: number | null;
  isUser: boolean;
};
export type DetailCuisine = { tag_id: number; name: string };
export type DetailTag = { tag_id: number; name: string; group: string; strength: number | null };

// recipe_features is stored per serving
export type DetailNutrition = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

export type RecipeDetail = {
  steps: DetailStep[];
  ingredients: DetailIngredient[];
  cuisine: DetailCuisine[];
  tags: DetailTag[];
  nutrition: DetailNutrition | null;
};

// Old posts (before recipe_steps existed) only have recipe_body: "1. ...\n2. ..."
export function stepsFromBody(body: string | null | undefined): DetailStep[] {
  return (body ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => ({
      step_no: i + 1,
      description: l.replace(/^\d+\.\s*/, ""),
      img: [],
    }));
}

// 1) all tag ids of the cuisine group, 2) which of them this recipe has in recipe_tags
async function fetchCuisine(recipeId: number): Promise<DetailCuisine[]> {
  const { data: tags, error } = await supabase
    .from("tags")
    .select("tag_id, tag_name")
    .eq("group_id", CUISINE_GROUP);
  if (error) throw error;
  const names = new Map<number, string>((tags ?? []).map((t: any) => [Number(t.tag_id), t.tag_name]));
  if (names.size === 0) {
    console.warn("[cuisine] no tags found for group", CUISINE_GROUP);
    return [];
  }

  const { data: rows, error: rtErr } = await supabase
    .from("recipe_tags")
    .select("tag_id")
    .eq("recipe_id", recipeId)
    .in("tag_id", Array.from(names.keys()));
  if (rtErr) throw rtErr;

  if (!rows || rows.length === 0) {
    console.log("[cuisine] recipe", recipeId, "has no cuisine row visible (cuisine tags:", names.size, ")");
  }
  return (rows ?? []).map((r: any) => ({ tag_id: Number(r.tag_id), name: names.get(Number(r.tag_id)) ?? "" }));
}

// All tags of the recipe (food group, flavor, texture, ...) except cuisine, which is shown on its own.
// Grouped by tag group on screen; a failure here must not break the whole post page.
async function fetchRecipeTags(recipeId: number): Promise<DetailTag[]> {
  const { data, error } = await supabase
    .from("recipe_tags")
    .select("tag_id, strength, tags ( tag_name, group_id, tag_groups ( group_name, sort_order ) )")
    .eq("recipe_id", recipeId);
  if (error) {
    console.warn("[recipe tags]", error.message);
    return [];
  }
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  return (data ?? [])
    .map((r: any) => {
      const t = one(r.tags);
      const g = one(t?.tag_groups);
      return {
        tag_id: Number(r.tag_id),
        name: String(t?.tag_name ?? ""),
        group: String(g?.group_name ?? "Other"),
        group_id: Number(t?.group_id ?? 0),
        order: Number(g?.sort_order ?? t?.group_id ?? 99),
        strength: r.strength != null ? Number(r.strength) : null,
      };
    })
    .filter((t) => t.name && t.group_id !== CUISINE_GROUP)
    .sort((a, b) => a.order - b.order || (b.strength ?? 0) - (a.strength ?? 0))
    .map(({ tag_id, name, group, strength }) => ({ tag_id, name, group, strength }));
}

async function fetchRecipeNutrition(recipeId: number): Promise<DetailNutrition | null> {
  const { data, error } = await supabase
    .from("recipe_features")
    .select("calories, protein, total_fat, carb, fiber, sugar, sodium")
    .eq("recipe_id", recipeId)
    .maybeSingle();
  if (error) {
    console.warn("[recipe nutrition]", error.message);
    return null;
  }
  if (!data) return null;
  const n = (v: any) => Number(v) || 0;
  return {
    calories: n(data.calories),
    protein: n(data.protein),
    fat: n(data.total_fat),
    carbs: n(data.carb),
    fiber: n(data.fiber),
    sugar: n(data.sugar),
    sodium: n(data.sodium),
  };
}

export async function fetchRecipeDetail(recipeId: number): Promise<RecipeDetail> {
  const [stepsRes, ingRes, cuisine, tags, nutrition] = await Promise.all([
    supabase
      .from("recipe_steps")
      .select("step_no, description, img")
      .eq("recipe_id", recipeId)
      .order("step_no", { ascending: true }),
    supabase
      .from("recipe_ingredients")
      .select(
        "ingredient_id, weight_g, ingredients ( name_en, norm_en, clean_en, source, user_id )",
      )
      .eq("recipe_id", recipeId)
      .order("recipe_ingredient_id", { ascending: true }),
    fetchCuisine(recipeId),
    fetchRecipeTags(recipeId),
    fetchRecipeNutrition(recipeId),
  ]);

  if (stepsRes.error) throw stepsRes.error;
  if (ingRes.error) throw ingRes.error;

  return {
    steps: (stepsRes.data ?? []).map((s: any) => ({
      step_no: s.step_no,
      description: s.description ?? "",
      img: s.img ?? [],
    })),
    ingredients: (ingRes.data ?? []).map((r: any) => {
      const ing = Array.isArray(r.ingredients) ? r.ingredients[0] : r.ingredients;
      return {
        ingredient_id: r.ingredient_id,
        name: ing?.norm_en ?? ing?.name_en ?? ing?.clean_en ?? "Unknown ingredient",
        weight_g: r.weight_g,
        // only ingredients a normal user created are "custom". Verified/system ones may also carry a
        // user_id (the admin who added them), so user_id alone must not decide this.
        isUser: ing?.source === "user",
      };
    }),
    cuisine,
    tags,
    nutrition,
  };
}

// Everything the edit form needs, only if the post is the caller's and not deleted
export async function fetchPostForEdit(
  forumId: number,
  userId: string,
): Promise<RecipeFormInitial> {
  const { data: post, error } = await supabase
    .from("recipe_forum")
    .select("recipe_forum_id, user_id, title, caption, hashtags, recipe_id, deleted_at")
    .eq("recipe_forum_id", forumId)
    .maybeSingle();
  if (error) throw error;
  if (!post || post.user_id !== userId || post.deleted_at || post.recipe_id == null) {
    throw new Error("This post can't be edited.");
  }

  const { data: recipe, error: rErr } = await supabase
    .from("recipes")
    .select("recipe_name, serving, img, recipe_body, additional_info")
    .eq("recipe_id", post.recipe_id)
    .single();
  if (rErr) throw rErr;

  const detail = await fetchRecipeDetail(Number(post.recipe_id));
  const stepRows = detail.steps.length > 0 ? detail.steps : stepsFromBody(recipe.recipe_body);

  const steps: StepItem[] = stepRows.map((s) => ({
    id: makeStepId() + s.step_no,
    text: s.description,
    images: s.img.map((uri) => ({ uri })),
  }));

  return {
    title: post.title ?? "",
    caption: post.caption ?? "",
    hashtags: (post.hashtags ?? []).map((t: string) => `#${t}`).join(" "),
    recipeName: recipe.recipe_name ?? "",
    serving: String(recipe.serving ?? 1),
    additionalInfo: recipe.additional_info ?? "",
    images: (recipe.img ?? []).map((uri: string) => ({ uri })),
    steps,
    ingredients: detail.ingredients.map((i) => {
      const source = (i.isUser ? "user" : SYSTEM_SOURCE) as any;
      return {
        key: makeIngredientKey(source, i.ingredient_id as any),
        source,
        id: i.ingredient_id as any,
        name: i.name,
        weight_g: i.weight_g != null ? String(i.weight_g) : "",
      };
    }),
    cuisineTagIds: detail.cuisine.map((c) => c.tag_id),
  };
}