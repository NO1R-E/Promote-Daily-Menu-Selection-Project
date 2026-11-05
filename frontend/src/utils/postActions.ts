import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { adminDeletePost, deletePost } from "@/src/api/forum";

type AppRouter = ReturnType<typeof useRouter>;

export function openEditPost(router: any, forumId: number) {
  router.push({
    pathname: "/(app)/(tabs)/forum/edit-post",
    params: { id: String(forumId) },
  });
}

// Admin removing someone else's post (goes through admin_delete_post, which also writes moderation_log)
export function confirmAdminDeletePost(postId: number, onDeleted: () => void) {
  Alert.alert(
    "Remove this post?",
    "You are removing another user's post as an admin. It will disappear from the forum and from meal recommendations. This can't be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await adminDeletePost(postId, "Removed by admin");
            onDeleted();
          } catch (err: any) {
            Alert.alert("Couldn't remove the post", err.message);
          }
        },
      },
    ],
  );
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