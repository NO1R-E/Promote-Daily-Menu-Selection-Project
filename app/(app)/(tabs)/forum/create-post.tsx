// app/(app)/forum/create-post.tsx
import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/config/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function CreatePostScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [ingredientsRaw, setIngredientsRaw] = useState("");
  const [stepsRaw, setStepsRaw] = useState("");

  const handlePublish = async () => {
    if (!title || !ingredientsRaw || !stepsRaw) {
      Alert.alert(
        "Missing Fields",
        "Please complete all inputs before publishing your recipe.",
      );
      return;
    }
    if (!user?.id) return;

    const ingredients_list = ingredientsRaw
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);
    const recipe_steps = stepsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // const { data: sessionData } = await supabase.auth.getSession();
    // console.log(
    //   "JWT Access Token Present:",
    //   !!sessionData?.session?.access_token,
    // );
    // console.log("Session User ID:", sessionData?.session?.user?.id);

    // if (!sessionData?.session) {
    //   Alert.alert(
    //     "Error",
    //     "Your security session expired. Please log out and log back in.",
    //   );
    //   return;
    // }

    const { error } = await supabase.from("recipe_forum").insert({
      user_id: user.id,
      title,
      ingredients_list,
      recipe_steps,
      img_url:
        "https://assets2.kansascitysteaks.com/dyn-images/pdp_hero/Ribeye_-_grilled_-_S-9ddcfb50325e18042116237659fdbf78.jpg", // Static placeholder string for now!
    });

    if (error) {
      Alert.alert("Submission Failed", error.message);
    } else {
      Alert.alert("Success!", "Recipe shared to feed.");
      router.replace("/(app)/(tabs)/forum"); // Send back to core index grid layout
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share a Recipe</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.label}>Recipe Title</Text>
      <TextInput
        placeholder="e.g., Crispy Fried Chicken"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />

      <Text style={styles.label}>
        Ingredients (Separate choices with a comma ',')
      </Text>
      <TextInput
        placeholder="e.g., Chicken thigh 400g, Oil 300ml, Garlic 2 cloves"
        value={ingredientsRaw}
        onChangeText={setIngredientsRaw}
        multiline
        style={[styles.input, styles.textArea]}
      />

      <Text style={styles.label}>
        Steps / Cooking Method (Separate steps with a comma ',')
      </Text>
      <TextInput
        placeholder="e.g., Heat your oil on the stove, Fry your chicken until gold, Serve hot"
        value={stepsRaw}
        onChangeText={setStepsRaw}
        multiline
        style={[styles.input, styles.textArea]}
      />

      <TouchableOpacity style={styles.button} onPress={handlePublish}>
        <Text style={styles.btnText}>Publish Post</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: "#fff", flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 24, color: "#333" },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 15,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E5EA",
    },
    backButton: { width: 40, height: 40, justifyContent: "center" },
    headerTitle: { fontSize: 20, fontWeight: "bold" },


});
