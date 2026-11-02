import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";

type AppRouter = ReturnType<typeof useRouter>;

export async function openRecipeInForum(router: AppRouter, recipeId: number | string) {
  const { data, error } = await supabase
    .from("recipe_forum")
    .select("recipe_forum_id")
    .eq("recipe_id", Number(recipeId))
    .eq("is_hidden", false)
    .limit(1)
    .maybeSingle();

  if (error) {
    Alert.alert("Couldn't open the recipe", error.message);
    return;
  }
  if (!data) {
    Alert.alert(
      "No recipe text yet",
      "This recipe doesn't have cooking steps yet. It will appear in the forum once a post is added.",
    );
    return;
  }
  router.push(`/(app)/post/${data.recipe_forum_id}` as any);
}