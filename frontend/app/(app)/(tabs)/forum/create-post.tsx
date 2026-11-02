import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/config/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import IngredientPickerSheet, {
  PickedIngredient,
  PickableIngredient,
  makeIngredientKey,
} from "@/components/forms/ingredientPickerSheet";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from "react-native";

const MAX_IMAGES = 4;

export default function CreatePostScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [recipeName, setRecipeName] = useState("");
  const [serving, setServing] = useState("1");
  const [stepsRaw, setStepsRaw] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [ingredients, setIngredients] = useState<PickedIngredient[]>([]);
  const [images, setImages] = useState<{ uri: string; base64: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  // กดเลือก/ยกเลิกวัตถุดิบจากหน้าต่างเลือก (แยกด้วย key กัน id ของวัตถุดิบระบบกับของตัวเองชนกัน)
  const toggleIngredient = (item: PickableIngredient) => {
    const key = makeIngredientKey(item.source, item.id);
    setIngredients((prev) =>
      prev.some((p) => p.key === key)
        ? prev.filter((p) => p.key !== key)
        : [...prev, { key, source: item.source, id: item.id, name: item.name, weight_g: "" }]
    );
  };

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], // was ImagePicker.MediaTypeOptions.Images (deprecated SDK52+)
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const picked = result.assets
      .filter((a) => a.base64)
      .map((a) => ({ uri: a.uri, base64: a.base64! }));
    setImages((prev) => [...prev, ...picked]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (userId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const uri = images[i].uri;
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const path = `${userId}/${Date.now()}-${i}.${ext}`;

      const { error } = await supabase.storage
        .from("recipe-images")
        .upload(path, decode(images[i].base64), {
          contentType: mimeType,
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("recipe-images")
        .getPublicUrl(path);

      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handlePublish = async () => {
    if (
      !title ||
      !recipeName ||
      !stepsRaw ||
      ingredients.length === 0 ||
      images.length === 0
    ) {
      Alert.alert(
        "Missing Fields",
        "Please provide a title, recipe name, at least 1 photo, at least 1 ingredient, and steps.",
      );
      return;
    }
    if (!user?.id) {
      Alert.alert("Authentication Error", "User not logged in.");
      return;
    }

    try {
      setLoading(true);

      const imgUrls = await uploadImages(user.id);

      const parsedHashtags = hashtags.split(/[ ,]+/).filter(Boolean);
      const parsedSteps = stepsRaw.split("\n").filter(Boolean);
      // วัตถุดิบทั้งของระบบและของผู้ใช้อยู่ในตาราง ingredients เดียวกัน ส่งรวมใน p_ingredients ได้เลย
      const parsedIngredients = ingredients.map((ing) => ({
        ingredient_id: ing.id,
        weight_g: parseFloat(ing.weight_g) || 0,
      }));

      const { error } = await supabase.rpc("create_recipe_post", {
        p_title: title,
        p_caption: caption,
        p_hashtags: parsedHashtags,
        p_recipe_name: recipeName,
        p_serving: parseInt(serving) || 1,
        p_img: imgUrls,
        p_steps: parsedSteps,
        p_additional_info: additionalInfo,
        p_ingredients: parsedIngredients,
      });

      if (error) throw error;

      Alert.alert("Success!", "Recipe shared to feed.");
      router.replace("/(app)/(tabs)/forum");
    } catch (err: any) {
      Alert.alert("Submission Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share a Recipe</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.label}>
        Photos ({images.length}/{MAX_IMAGES})
      </Text>
      <View style={styles.imageRow}>
        {images.map((img, idx) => (
          <View key={idx} style={{ position: "relative" }}>
            <Image source={{ uri: img.uri }} style={styles.thumbnail} />
            <TouchableOpacity
              style={styles.removeBadge}
              onPress={() => removeImage(idx)}
              disabled={loading}
            >
              <Ionicons name="close-circle" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ))}
        {images.length < MAX_IMAGES && (
          <TouchableOpacity
            style={styles.imagePlaceholder}
            onPress={pickImages}
            disabled={loading}
          >
            <Ionicons name="camera" size={24} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.label}>Post Title</Text>
      <TextInput
        placeholder="e.g., The Best Crispy Fried Chicken"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        editable={!loading}
      />

      <Text style={styles.label}>Caption</Text>
      <TextInput
        placeholder="Tell us about this post..."
        value={caption}
        onChangeText={setCaption}
        multiline
        style={[styles.input, { height: 80 }]}
        editable={!loading}
      />

      <Text style={styles.label}>Hashtags (comma or space separated)</Text>
      <TextInput
        placeholder="#chicken #fried #dinner"
        value={hashtags}
        onChangeText={setHashtags}
        style={styles.input}
        editable={!loading}
      />

      <Text style={styles.label}>Recipe Name</Text>
      <TextInput
        placeholder="Crispy Fried Chicken"
        value={recipeName}
        onChangeText={setRecipeName}
        style={styles.input}
        editable={!loading}
      />

      <Text style={styles.label}>Serving Size</Text>
      <TextInput
        placeholder="2"
        value={serving}
        onChangeText={setServing}
        keyboardType="number-pad"
        style={styles.input}
        editable={!loading}
      />

      <Text style={styles.label}>Ingredients</Text>
      {ingredients.map((ing, i) => (
        <View key={ing.key} style={styles.rowItem}>
          <View style={{ flex: 1 }}>
            <Text>{ing.name}</Text>
            {ing.source === "user" && <Text style={styles.myBadge}>My ingredient</Text>}
          </View>
          <TextInput
            style={[styles.input, { width: 90, padding: 8 }]}
            value={ing.weight_g}
            keyboardType="decimal-pad"
            placeholder="grams"
            editable={!loading}
            onChangeText={(t) =>
              setIngredients((prev) => prev.map((v, idx) => (idx === i ? { ...v, weight_g: t } : v)))
            }
          />
          <TouchableOpacity
            onPress={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))}
            style={{ marginLeft: 10 }}
            disabled={loading}
          >
            <Ionicons name="close-circle" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={styles.addIngredientBtn}
        activeOpacity={0.8}
        onPress={() => setIsPickerVisible(true)}
        disabled={loading}
      >
        <Ionicons name="add-circle-outline" size={20} color="#F28E2B" />
        <Text style={styles.addIngredientText}>Add ingredient</Text>
      </TouchableOpacity>

      <Text style={styles.label}>
        Steps / Cooking Method (One step per line)
      </Text>
      <TextInput
        placeholder={
          "1. Heat your oil on the stove\n2. Fry your chicken until gold"
        }
        value={stepsRaw}
        onChangeText={setStepsRaw}
        multiline
        style={[styles.input, styles.textArea]}
        editable={!loading}
      />

      <Text style={styles.label}>Additional Info (Optional)</Text>
      <TextInput
        placeholder="Dietary notes, substitution tips..."
        value={additionalInfo}
        onChangeText={setAdditionalInfo}
        multiline
        style={[styles.input, { height: 80 }]}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handlePublish}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Publish Post</Text>
        )}
      </TouchableOpacity>
    </ScrollView>

    <IngredientPickerSheet
      visible={isPickerVisible}
      onClose={() => setIsPickerVisible(false)}
      picked={ingredients}
      onToggle={toggleIngredient}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: "#fff", flexGrow: 1 },
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
  textArea: { height: 120, textAlignVertical: "top" },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    marginBottom: 10,
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  imageRow: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
  thumbnail: { width: 70, height: 70, borderRadius: 8 },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  myBadge: { fontSize: 11, fontWeight: "600", color: "#C96A0A", marginTop: 2 },
  addIngredientBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#F6C48F",
    backgroundColor: "#FFF5EA",
    marginTop: 4,
  },
  addIngredientText: { marginLeft: 6, fontSize: 15, fontWeight: "600", color: "#C96A0A" },
  imagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
  },
});
