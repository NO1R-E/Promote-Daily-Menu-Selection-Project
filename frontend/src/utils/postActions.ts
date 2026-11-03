import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { deletePost } from "@/src/api/forum";

type AppRouter = ReturnType<typeof useRouter>;

export function openEditPost(router: any, forumId: number) {
  router.push({
    pathname: "/(app)/(tabs)/forum/edit-post",
    params: { id: String(forumId) },
  });
}

export function confirmDeletePost(postId: number, onDeleted: () => void) {
  Alert.alert(
    "Delete this post?",
    "It will be removed from the forum and from meal recommendations. This can't be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(postId);
            onDeleted();
          } catch (err: any) {
            Alert.alert("Couldn't delete the post", err.message);
          }
        },
      },
    ],
  );
}