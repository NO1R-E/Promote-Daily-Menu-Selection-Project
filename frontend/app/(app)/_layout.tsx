import { AuthProvider } from "@/src/contexts/AuthContext";
import { HealthProvider } from "@/src/contexts/HealthContext";
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <AuthProvider>
      <HealthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </HealthProvider>
    </AuthProvider>
  );
}
