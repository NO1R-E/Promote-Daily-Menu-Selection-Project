import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;
  if (!isAdmin) return <Redirect href="/(app)/(tabs)/forum" />;

  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="index" options={{ title: "Admin" }} />
      <Stack.Screen name="reports" options={{ title: "Reports queue" }} />
      <Stack.Screen name="users" options={{ title: "Users & bans" }} />
      <Stack.Screen
        name="ingredient-queue"
        options={{ title: "Ingredient review" }}
      />
      <Stack.Screen
        name="add-ingredient"
        options={{ title: "Add ingredient" }}
      />
    </Stack>
  );
}
