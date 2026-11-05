// Admin: unverified ingredients, most used (by distinct users) first. Tap one to review, edit and verify it.

import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";

type QueueItem = {
  ingredient_id: number;
  norm_en: string | null;
  norm_th: string | null;
  users_count: number;
  recipes_count: number;
};

export default function IngredientQueueScreen() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase.rpc("admin_ingredient_queue", {
      p_min_users: 1,
      p_limit: 100,
    });
    if (err) {
      console.log("Error loading ingredient queue:", err.message);
      setError("Couldn't load the queue.");
    } else {
      setItems((data as QueueItem[]) ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  // reload every time the screen is shown (e.g. after verifying one)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={items}
      keyExtractor={(i) => String(i.ingredient_id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
      ListHeaderComponent={
        <Text style={styles.hint}>
          Unverified ingredients that are used in posts, most popular first. Recipes become verified
          when all of their ingredients are verified.
        </Text>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>{error ?? "Nothing to review right now."}</Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => router.push(`/(app)/ingredient/${item.ingredient_id}` as any)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.norm_en || item.norm_th}</Text>
            {!!item.norm_en && !!item.norm_th && <Text style={styles.sub}>{item.norm_th}</Text>}
            <Text style={styles.sub}>
              {item.users_count} {item.users_count === 1 ? "user" : "users"} · {item.recipes_count}{" "}
              {item.recipes_count === 1 ? "recipe" : "recipes"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#BBB" />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hint: { fontSize: 12, color: "#888", marginBottom: 12, lineHeight: 17 },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  name: { fontSize: 15, fontWeight: "600", color: "#222" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
});
