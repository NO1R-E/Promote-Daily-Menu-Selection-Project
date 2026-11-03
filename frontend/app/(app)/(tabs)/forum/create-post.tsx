import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";
import { markForumDirty } from "@/src/api/forum";
import RecipeForm from "@/components/forms/RecipeForm";

export default function CreatePostScreen() {
  const router = useRouter();

  return (
    <RecipeForm
      headerTitle="Share a Recipe"
      submitLabel="Publish Post"
      onSubmit={async (params) => {
        const { error } = await supabase.rpc("create_recipe_post", params);
        if (error) throw error;
        markForumDirty();
        Alert.alert("Success!", "Recipe shared to feed.");
        router.replace("/(app)/(tabs)/forum");
      }}
    />
  );
}
