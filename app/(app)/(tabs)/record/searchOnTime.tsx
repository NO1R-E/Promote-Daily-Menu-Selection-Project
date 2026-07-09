import { useEffect, useState } from "react";
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

export default function FoodSearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { meal_type, selected_date } = useLocalSearchParams<{ meal_type: string; selected_date: string }>();

  // 🌟 1. สร้าง State สำหรับเก็บรายชื่ออาหารที่ดึงมาจากฐานข้อมูลจริง
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 2. ใช้ useEffect ดึงเมนูอาหารมาจาก Supabase ทันทีที่เปิดหน้านี้
  useEffect(() => {
    async function fetchRecipesFromDB() {
      try {
        setIsLoadingRecipes(true);
        // ดึงชื่อเมนู รูปภาพ และดึงแคลอรีทะลุผ่านตารางเชื่อมโยงมาด้วย
        const { data, error } = await supabase
          .from("recipe")
          .select(`
            recipe_id,
            name,
            image,
            recipe_nutrient!fk_nutrient_to_recipe (
              calories
            )
          `);

        if (error) throw error;
        if (data) setRecipes(data);
      } catch (error: any) {
        console.error("Error fetching recipes:", error);
        Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลคลังอาหารได้");
      } finally {
        setIsLoadingRecipes(false);
      }
    }
    fetchRecipesFromDB();
  }, []);

  const handleSelectFood = async (recipeId: number, recipeName: string) => {
    if (!user) {
      Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }

    const targetDate = selected_date || new Date().toISOString().split("T")[0];

    try {
      setIsSubmitting(true);

      // ตรวจสอบตารางแม่ (daily_record)
      let { data: dailyRecord, error: fetchError } = await supabase
        .from("daily_record")
        .select("record_id")
        .eq("user_id", user.id)
        .eq("record_date", targetDate)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let currentRecordId = dailyRecord?.record_id;

      // ถ้ายังไม่มีตารางแม่ของวันนี้ ให้สร้างขึ้นมาใหม่
      if (!dailyRecord) {
        const { data: newRecord, error: insertRecordError } = await supabase
          .from("daily_record")
          .insert({ user_id: user.id, record_date: targetDate })
          .select("record_id")
          .single();

        if (insertRecordError) throw insertRecordError;
        currentRecordId = newRecord.record_id;
      }

      // บันทึกอาหารจานนี้ลงตารางลูก (record_item)
      const { error: insertItemError } = await supabase
        .from("record_item")
        .insert({
          record_id: currentRecordId,
          meal_type: meal_type,
          recipe_id: recipeId
        });

      if (insertItemError) throw insertItemError;

      Alert.alert("สำเร็จ", `บันทึก ${recipeName} ลงในมื้อ ${meal_type} เรียบร้อยแล้ว!`);
      router.back();

    } catch (error: any) {
      console.error("Error saving record:", error);
      Alert.alert("เกิดข้อผิดพลาด", error.message || "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เลือกอาหารสำหรับมื้อ {meal_type}</Text>
      </View>

      {isLoadingRecipes || isSubmitting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {isLoadingRecipes ? "กำลังโหลดคลังอาหาร..." : "กำลังบันทึกข้อมูล..."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.recipe_id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.foodCard}
              onPress={() => handleSelectFood(item.recipe_id, item.name)}
            >
              <Image source={{ uri: item.image || "https://via.placeholder.com/150" }} style={styles.foodImage} />

              <View style={styles.foodInfo}>
                <Text style={styles.foodName}>{item.name}</Text>
                <Text style={styles.foodCal}>
                  {Array.isArray(item.recipe_nutrient)
                    ? (item.recipe_nutrient[0]?.calories || 0)
                    : (item.recipe_nutrient?.calories || 0)}{" "}kcal
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", marginTop: 50, marginBottom: 20 },
  backBtn: { marginRight: 15, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A", textTransform: "capitalize" },
  foodCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F9FA", padding: 12, borderRadius: 16, marginBottom: 12 },
  foodImage: { width: 60, height: 60, borderRadius: 12, marginRight: 15 },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 16, fontWeight: "600", color: "#333" },
  foodCal: { fontSize: 14, color: "#666", marginTop: 4 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 14, color: "#666", fontWeight: "500" }
});