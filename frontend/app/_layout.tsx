import { AuthProvider, useAuth } from "@/src/contexts/AuthContext"; // Fix path to your context file
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

function NavigationGate() {
  const { user, loading, hasCompletedOnboarding, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/login");
    } else if (isAdmin) {
      router.replace("/(admin)/tempScreen");
    } else if (user && !hasCompletedOnboarding) {
      //router.replace("/(app)/(tabs)/chatbot");
      router.replace("/(onboarding)/personalData");
    } else {
      router.replace("/(app)/(tabs)/chatbot");
    }
  }, [user, loading, hasCompletedOnboarding]);

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
