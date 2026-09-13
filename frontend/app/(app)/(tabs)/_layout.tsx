// import { Tabs } from "expo-router";

// export default function TabsLayout() {
//   return (
//     <Tabs screenOptions={{ tabBarActiveTintColor: "#007AFF" }}>
//       <Tabs.Screen name="chatbot" options={{ title: "AI Chatbot" }} />
//       <Tabs.Screen
//         name="forum"
//         options={{ title: "Forum", headerShown: false }}
//       />
//       <Tabs.Screen
//         name="record"
//         options={{ title: "Record", headerShown: false }} />
//       <Tabs.Screen
//         name="profile"
//         options={{ title: "Profile", headerShown: false }}
//       />
//     </Tabs>
//   );
// }

import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function TabsLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          drawerActiveTintColor: "orange",
          drawerHideStatusBarOnOpen: true,
        }}
      >
        <Drawer.Screen
          name="forum"
          options={{
            drawerLabel: "Home",
            title: "Home",
            drawerIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
            headerTitleAlign: "center",
          }}
        />
        <Drawer.Screen
          name="chatbot"
          options={{
            drawerLabel: "ChatBot",
            title: "ChatBot",
            drawerIcon: ({ color, size }) => (
              <Ionicons name="chatbox" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="record"
          options={{
            drawerLabel: "Record",
            title: "Record",
            drawerIcon: ({ size, color }) => (
              <Ionicons name="fitness" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            drawerLabel: "Profile",
            title: "Profile",
            drawerIcon: ({ size, color }) => (
              <Ionicons name="person-circle" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
