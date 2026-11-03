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
import IngredientTagPicker from "@/components/forms/IngredientTagPicker";
import { CUISINE_GROUP_ID, sanitizeNumber } from "@/components/forms/ingredientCommon";
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

const MAX_IMAGES = 1;
const MAX_STEPS = 8; // จำนวนขั้นตอนสูงสุด
const MAX_STEP_IMAGES = 2; // รูปต่อ 1 ขั้นตอน

type PickedImage = { uri: string; base64: string };
type StepItem = { id: string; text: string; images: PickedImage[] };

const newStep = (): StepItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text: "",
  images: [],
});

export default function CreatePostScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [recipeName, setRecipeName] = useState("");
  const [serving, setServing] = useState("1");
  // ขั้นตอนการทำ: เริ่มที่ Step 1 ผู้ใช้กดเพิ่มเองได้สูงสุด MAX_STEPS ขั้นตอน
  const [steps, setSteps] = useState<StepItem[]>(() => [newStep()]);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [ingredients, setIngredients] = useState<PickedIngredient[]>([]);
  const [images, setImages] = useState<{ uri: string; base64: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  // เปิดเมื่อกดโพสต์แล้วมีวัตถุดิบที่ยังไม่กรองน้ำหนัก (ใช้ไฮไลต์ช่องนั้นเป็นสีแดง)
  const [weightError, setWeightError] = useState(false);
  // แท็ก Cuisine/Culture ของสูตร (เลือกที่นี่ ไม่ได้เลือกตอนเพิ่มวัตถุดิบ)
  const [cuisineTagIds, setCuisineTagIds] = useState<number[]>([]);

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

  // ----- ขั้นตอนการทำ -----
  const addStep = () => {
    if (steps.length >= MAX_STEPS) return;
    setSteps((prev) => [...prev, newStep()]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  };

  const updateStepText = (id: string, text: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const pickStepImages = async (id: string) => {
    const step = steps.find((s) => s.id === id);
    if (!step) return;
    const remaining = MAX_STEP_IMAGES - step.images.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;

    const picked = result.assets
      .filter((a) => a.base64)
      .map((a) => ({ uri: a.uri, base64: a.base64! }))
      .slice(0, remaining);
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, images: [...s.images, ...picked] } : s))
    );
  };

  const removeStepImage = (id: string, index: number) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, images: s.images.filter((_, i) => i !== index) } : s))
    );
  };

  // อัปโหลดรูป 1 รูปขึ้น bucket "recipe-images" (ที่เดียวกับรูปอาหาร ใช้โฟลเดอร์ของผู้ใช้เหมือนเดิม)
  const uploadOne = async (userId: string, img: PickedImage, label: string): Promise<string> => {
    const ext = img.uri.split(".").pop()?.toLowerCase() || "jpg";
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";
    const path = `${userId}/${Date.now()}-${label}.${ext}`;

    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(path, decode(img.base64), {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
    return data.publicUrl;
  };

  // รูปอาหาร (path เหมือนเดิม: <userId>/<เวลา>-<ลำดับ>.<นามสกุล>)
  const uploadImages = async (userId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      urls.push(await uploadOne(userId, images[i], String(i)));
    }
    return urls;
  };

  const handlePublish = async () => {
    // ขั้นตอนที่ใช้จริง: ตัดขั้นตอนที่ว่างทั้งข้อความและรูปทิ้ง (เลขขั้นตอนนับตามลำดับบนหน้าจอ)
    const filledSteps = steps
      .map((s, i) => ({ ...s, text: s.text.trim(), no: i + 1 }))
      .filter((s) => s.text !== "" || s.images.length > 0);

    if (
      !title ||
      !recipeName ||
      filledSteps.length === 0 ||
      ingredients.length === 0 ||
      images.length === 0
    ) {
      Alert.alert(
        "Missing Fields",
        "Please provide a title, recipe name, at least 1 photo, at least 1 ingredient, and steps.",
      );
      return;
    }

    // ทุกวัตถุดิบต้องมีน้ำหนักมากกว่า 0 กรัม
    // (น้ำหนักว่างหรือ 0 ทำให้สูตรไม่มีข้อมูลโภชนาการ และไม่เข้าระบบแนะนำเมนู)
    const ingredientWithoutWeight = ingredients.find((ing) => !(parseFloat(ing.weight_g) > 0));
    if (ingredientWithoutWeight) {
      setWeightError(true);
      Alert.alert(
        "Missing Ingredient Amount",
        `Please enter the amount (in grams) for "${ingredientWithoutWeight.name}".`
      );
      return;
    }

    // ต้องเลือก Cuisine/Culture ให้ครบ 1 อัน
    if (cuisineTagIds.length !== 1) {
      Alert.alert("Missing Cuisine / Culture", "Please select one cuisine / culture for your recipe.");
      return;
    }

    const stepWithoutText = filledSteps.find((s) => s.text === "");
    if (stepWithoutText) {
      Alert.alert("Missing Step Description", `Please describe Step ${stepWithoutText.no}.`);
      return;
    }
    if (!user?.id) {
      Alert.alert("Authentication Error", "User not logged in.");
      return;
    }

    try {
      setLoading(true);

      const imgUrls = await uploadImages(user.id);

      // รูปของแต่ละขั้นตอน: อัปโหลดไว้ใน bucket เดียวกับรูปอาหาร (ขั้นตอนละ 0-MAX_STEP_IMAGES รูป)
      const stepImgUrls: string[][] = [];
      for (const st of filledSteps) {
        const urls: string[] = [];
        for (let j = 0; j < st.images.length; j++) {
          urls.push(await uploadOne(user.id, st.images[j], `s${st.no}-${j}`));
        }
        stepImgUrls.push(urls);
      }

      const parsedHashtags = hashtags.split(/[ ,]+/).filter(Boolean);
      const parsedSteps = filledSteps.map((s) => s.text); // ข้อความของแต่ละขั้นตอน (ลำดับตรงกับ stepImgUrls)
      // วัตถุดิบทั้งของระบบและของผู้ใช้อยู่ในตาราง ingredients เดียวกัน ส่งรวมใน p_ingredients ได้เลย
      const parsedIngredients = ingredients.map((ing) => ({
        ingredient_id: ing.id,
        weight_g: parseFloat(ing.weight_g) || 0,
      }));

      const rpcParams: Record<string, any> = {
        p_title: title,
        p_caption: caption,
        p_hashtags: parsedHashtags,
        p_recipe_name: recipeName,
        p_serving: parseInt(serving) || 1,
        p_img: imgUrls,
        p_steps: parsedSteps,
        p_additional_info: additionalInfo,
        p_ingredients: parsedIngredients,
      };
      // แท็ก Cuisine/Culture บังคับ 1 อันเสมอ จึงต้องรัน create_recipe_post_steps_cuisine.sql ก่อนใช้แอปเวอร์ชันนี้
      rpcParams.p_tag_ids = cuisineTagIds;
      // รูปของขั้นตอนส่งเฉพาะเมื่อมี
      if (stepImgUrls.some((u) => u.length > 0)) rpcParams.p_step_imgs = stepImgUrls;

      const { error } = await supabase.rpc("create_recipe_post", rpcParams);

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
          <Ionicons name="arrow-back" size={24} color="#F28E2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share a Recipe</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.label}>
        Photos ({images.length}/{MAX_IMAGES}) *
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

      <Text style={styles.label}>Post Title *</Text>
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

      <Text style={styles.label}>Recipe Name *</Text>
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

      <Text style={styles.label}>Cuisine / Culture * (select one)</Text>
      <IngredientTagPicker
        selected={cuisineTagIds}
        onChange={setCuisineTagIds}
        onlyGroupIds={[CUISINE_GROUP_ID]}
        defaultExpanded
        hideSummary
        singleSelect
        disabled={loading}
      />

      <Text style={styles.label}>Ingredients *</Text>
      {ingredients.map((ing, i) => (
        <View key={ing.key} style={styles.rowItem}>
          <View style={{ flex: 1 }}>
            <Text>{ing.name}</Text>
            {ing.source === "user" && <Text style={styles.myBadge}>My ingredient</Text>}
          </View>
          <TextInput
            style={[
              styles.input,
              { width: 90, padding: 8 },
              weightError && !(parseFloat(ing.weight_g) > 0) && styles.inputError,
            ]}
            value={ing.weight_g}
            keyboardType="decimal-pad"
            placeholder="grams"
            editable={!loading}
            onChangeText={(t) =>
              setIngredients((prev) =>
                prev.map((v, idx) => (idx === i ? { ...v, weight_g: sanitizeNumber(t) } : v))
              )
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
        Steps / Cooking Method ({steps.length}/{MAX_STEPS}) *
      </Text>
      {steps.map((step, idx) => (
        <View key={step.id} style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>Step {idx + 1}</Text>
            {steps.length > 1 && (
              <TouchableOpacity
                onPress={() => removeStep(step.id)}
                disabled={loading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            placeholder={idx === 0 ? "e.g., Heat the oil on the stove" : "Describe this step..."}
            value={step.text}
            onChangeText={(t) => updateStepText(step.id, t)}
            multiline
            style={[styles.input, styles.stepInput]}
            editable={!loading}
          />

          <View style={styles.imageRow}>
            {step.images.map((img, j) => (
              <View key={j} style={{ position: "relative" }}>
                <Image source={{ uri: img.uri }} style={styles.thumbnail} />
                <TouchableOpacity
                  style={styles.removeBadge}
                  onPress={() => removeStepImage(step.id, j)}
                  disabled={loading}
                >
                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
            {step.images.length < MAX_STEP_IMAGES && (
              <TouchableOpacity
                style={styles.imagePlaceholder}
                onPress={() => pickStepImages(step.id)}
                disabled={loading}
              >
                <Ionicons name="camera" size={24} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {steps.length < MAX_STEPS && (
        <TouchableOpacity
          style={styles.addIngredientBtn}
          activeOpacity={0.8}
          onPress={addStep}
          disabled={loading}
        >
          <Ionicons name="add-circle-outline" size={20} color="#F28E2B" />
          <Text style={styles.addIngredientText}>Add step</Text>
        </TouchableOpacity>
      )}

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
    color: "#C96A0A",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#F28E2B",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  inputError: { borderColor: "#FF3B30", backgroundColor: "#FFF5F5" },
  textArea: { height: 120, textAlignVertical: "top" },
  button: {
    backgroundColor: "#F28E2B",
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
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#F28E2B" },
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
  stepCard: {
    borderWidth: 1.5,
    borderColor: "#F6C48F",
    backgroundColor: "#FFFAF4",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stepTitle: { fontSize: 14, fontWeight: "700", color: "#C96A0A" },
  stepInput: { minHeight: 70, textAlignVertical: "top", backgroundColor: "#FFFFFF" },
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
