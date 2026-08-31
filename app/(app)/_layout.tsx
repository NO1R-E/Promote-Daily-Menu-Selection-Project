import { AuthProvider } from "@/src/contexts/AuthContext";
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
