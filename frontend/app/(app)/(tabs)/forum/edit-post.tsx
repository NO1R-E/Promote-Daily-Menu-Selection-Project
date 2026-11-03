import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";
import { markForumDirty } from "@/src/api/forum";
import { fetchPostForEdit } from "@/src/api/recipeDetail";
import { useAuth } from "@/src/contexts/AuthContext";
import RecipeForm, { RecipeFormInitial } from "@/components/forms/RecipeForm";

export default function EditPostScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const forumId = Number(id);

  const [initial, setInitial] = useState<RecipeFormInitial | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchPostForEdit(forumId, user.id)
      .then((data) => !cancelled && setInitial(data))
      .catch(
        (e) => !cancelled && setError(e.message ?? "Couldn't load this post."),
      );
    return () => {
      cancelled = true;
    };
  }, [forumId, user?.id]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text
          style={{ color: "#B00020", marginBottom: 12, textAlign: "center" }}
        >
          {error}
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#F28E2B", fontWeight: "600" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!initial) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#F28E2B" />
      </View>
    );
  }

  return (
    <RecipeForm
      headerTitle="Edit Recipe"
      submitLabel="Save Changes"
      initial={initial}
      onSubmit={async (params) => {
        const { error: rpcError } = await supabase.rpc("update_recipe_post", {
          p_forum_id: forumId,
          ...params,
        });
        if (rpcError) throw rpcError;
        markForumDirty();
        Alert.alert("Saved", "Your post was updated.");
        router.back();
      }}
    />
  );
}
