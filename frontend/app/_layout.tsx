import { AuthProvider, useAuth } from "@/src/contexts/AuthContext"; // Fix path to your context file
import { HealthProvider } from "@/src/contexts/HealthContext";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

function NavigationGate() {
  const { user, loading, onboardingStatus, isAdmin, homeRoute } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/login");
    } else if (isAdmin) {
      router.replace(homeRoute);
    } else if (user && onboardingStatus === "not_started") {
      //router.replace("/(app)/(tabs)/chatbot");
      router.replace("/(onboarding)");
    } else {
      router.replace(homeRoute);
    }
  }, [user, loading, onboardingStatus]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#00ff00" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <HealthProvider>
        <NavigationGate />
      </HealthProvider>
    </AuthProvider>
  );
}
