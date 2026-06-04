import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#007AFF" }}>
      <Tabs.Screen name="chatbot" options={{ title: "AI Chatbot" }} />
      <Tabs.Screen
        name="forum"
        options={{ title: "Forum", headerShown: false }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen
        name="setting"
        options={{ title: "Setting", headerShown: false }}
      />
    </Tabs>
  );
}
