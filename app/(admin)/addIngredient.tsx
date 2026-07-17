import { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";

export default function AddIngredientScreen() {
  const router = useRouter();
  const [normEn, setNormEn] = useState("");
  const [normTh, setNormTh] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddIngredient = async () => {
    if (!normEn.trim() || !normTh.trim()) {
      Alert.alert("คำเตือน", "กรุณากรอกชื่อวัตถุดิบให้ครบทั้งภาษาไทยและอังกฤษ");
      return;
    }

    try {
      setLoading(true);

      // 1. ดักหา ID ล่าสุดจากตาราง ingredients (เรียงจากมากไปน้อย แล้วเอาตัวบนสุดมาตัวเดียว)
      const { data: lastIngredient, error: fetchError } = await supabase
        .from("ingredients")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 คือโค้ดกรณีไม่มีข้อมูลเลย (ตารางว่าง) ถ้าเป็น error อื่นให้ throw ออกไป
        throw fetchError;
      }

      // คำนวณ ID ถัดไป: ถ้ามีข้อมูลเอา id + 1, ถ้าไม่มีข้อมูลเลยให้เริ่มที่ 1 (หรือ 1782 ตามที่คุณระบุ)
      const nextId = lastIngredient ? lastIngredient.id + 1 : 1782;

      // 2. Insert ข้อมูลวัตถุดิบใหม่เข้าฐานข้อมูล
      const { error: insertError } = await supabase
        .from("ingredients")
        .insert([
          {
            id: nextId, // 💡 หากฐานข้อมูลตั้งเป็น Auto-increment อยู่แล้ว สามารถลบบรรทัดนี้ออกได้เลยครับ
            norm_en: normEn.trim(),
            norm_th: normTh.trim(),
          },
        ]);

      if (insertError) throw insertError;

      Alert.alert("สำเร็จ", `เพิ่มวัตถุดิบ ${normTh} เรียบร้อยแล้ว (ID: ${nextId})`, [
        {
          text: "ตกลง",
          onPress: () => {
            // เคลียร์ค่าในฟอร์ม
            setNormEn("");
            setNormTh("");
            // ย้อนกลับไปหน้าก่อนหน้า
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error("Error adding ingredient:", error.message);
      Alert.alert("Error", "ไม่สามารถเพิ่มวัตถุดิบได้: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/*<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>*/}
        <Text style={styles.headerTitle}>Add Ingredient</Text>
        <View style={{ width: 24 }} /> 
      </View>

      {/* Form Content */}
      <View style={styles.formContainer}>
        <Text style={styles.label}>Ingredient name (English)</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Chicken Breast"
          value={normEn}
          onChangeText={setNormEn}
          placeholderTextColor="#8E8E93"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Ingredient name (Thai)</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: อกไก่"
          value={normTh}
          onChangeText={setNormTh}
          placeholderTextColor="#8E8E93"
        />

        {/* ปุ่มบันทึก */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.disabledButton]}
          onPress={handleAddIngredient}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Save Ingredient</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  formContainer: { padding: 20, marginTop: 10 },
  label: { fontSize: 14, fontWeight: "600", color: "#3A3A3C", marginBottom: 8, marginLeft: 4 },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#333",
    marginBottom: 20,
    backgroundColor: "#FFF",
  },
  saveButton: {
    flexDirection: "row",
    backgroundColor: "#F28E2B", // ใช้โทนสีส้มเดียวกับแอปหลักของคุณ
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledButton: { backgroundColor: "#F28E2B", opacity: 0.6 },
  saveButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});