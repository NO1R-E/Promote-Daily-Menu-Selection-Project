import { AuthProvider, useAuth } from "@/src/contexts/AuthContext"; // Fix path to your context file
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

function NavigationGate() {
  const { user, loading, hasCompletedOnboarding } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 1. If Supabase is still loading or checking local storage, do nothing yet
    if (loading) return;

    // 2. Traffic Controller Logic
    if (!user) {
      // Not logged in? Force them to the authentication screens (login/register)
      router.replace("/(auth)/login");
    } else if (user && !hasCompletedOnboarding) {
      // Logged in but missing physical metrics/allergies? Route them to onboarding
      router.replace("/(app)/(tabs)/chatbot");
      // router.replace("/(onboarding)/personalData");
    } else {
      // Fully logged in and profile setup complete? Straight to the core app
      router.replace("/(app)/(tabs)/chatbot");
    }
  }, [user, loading, hasCompletedOnboarding]);

  // Display a clean loading indicator while checking auth states
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

  // Once loading is finished, render your structural layout slots
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
      <NavigationGate />
    </AuthProvider>
  );
}
