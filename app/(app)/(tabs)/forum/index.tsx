// app/(app)/forum/index.tsx
import { supabase } from "@/src/config/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ForumIndex() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recipe_forum")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setRecipes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recipes}
        keyExtractor={(item, index) =>
          item?.id ? item.id.toString() : index.toString()
        }
        onRefresh={fetchRecipes}
        refreshing={loading}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No recipes posted yet. Be the first!
          </Text>
        }
        renderItem={({ item }) => {
          const ingredients = item?.ingredients_list || [];
          const steps = item?.recipe_steps || [];

          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {item?.title || "Untitled Recipe"}
              </Text>
              <Image
                style={{ width: 50, height: 50 }}
                source={{ uri: item.img_url }}
              ></Image>
              <Text style={styles.sectionHeader}>Ingredients:</Text>
              {ingredients.map((ing: string, i: number) => (
                <Text key={i} style={styles.itemText}>
                  • {ing}
                </Text>
              ))}

              <Text style={styles.sectionHeader}>Steps:</Text>
              {steps.map((step: string, i: number) => (
                <Text key={i} style={styles.itemText}>
                  {i + 1}. {step}
                </Text>
              ))}

              <Text style={styles.likes}>💗{item?.likes_count ?? 0} likes</Text>
            </View>
          );
        }}
      />

      {/* Floating Action Button to write a post */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(app)/(tabs)/forum/create-post")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginTop: 8,
    marginBottom: 2,
  },
  itemText: { fontSize: 14, color: "#444", marginLeft: 4 },
  likes: { marginTop: 12, fontSize: 12, color: "#888", fontWeight: "500" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#666" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#007AFF",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", bottom: 2 },
});
