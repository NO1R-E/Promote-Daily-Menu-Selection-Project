import React, { useLayoutEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";

const ITEMS = [
  {
    href: "/(app)/(tabs)/admin/reports",
    label: "Reports queue",
    hint: "Review flagged posts",
    icon: "flag",
  },
  {
    href: "/(app)/(tabs)/admin/users",
    label: "Users & bans",
    hint: "Search users, ban or unban",
    icon: "people",
  },
  {
    href: "/(app)/(tabs)/admin/add-ingredient",
    label: "Add ingredient",
    hint: "Add to the ingredient database",
    icon: "nutrition",
  },
] as const;

export default function AdminHub() {
  const router = useRouter();
  const navigation: any = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          style={{ marginLeft: 12 }}
          onPress={() => navigation.getParent()?.openDrawer?.()}
        >
          <Ionicons name="menu" size={24} color="#333" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      {ITEMS.map((item) => (
        <TouchableOpacity
          key={item.href}
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => router.push(item.href as any)}
        >
          <View style={styles.iconCircle}>
            <Ionicons name={item.icon as any} size={22} color="#FF7A00" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.hint}>{item.hint}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#BBB" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#F8F9FA" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
  },
  label: { fontSize: 15, fontWeight: "600", color: "#222" },
  hint: { fontSize: 12, color: "#888", marginTop: 2 },
});
