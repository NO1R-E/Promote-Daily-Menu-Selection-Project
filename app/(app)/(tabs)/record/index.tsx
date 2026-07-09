import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase"; // 👈 นำเข้า Supabase
import { useAuth } from "@/src/contexts/AuthContext"; // 👈 นำเข้า Auth สำหรับเอา user.id
import { useFocusEffect } from "expo-router";

// กำหนดเป้าหมายสารอาหารแต่ละวัน (สำหรับใช้เป็นตัวหารในแถบสถิติ)
const TARGETS = { calories: 2000, fat: 65, protein: 60, carbs: 300, sugar: 50, sodium: 2000 };

export default function TrackingRecordScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<any[]>([]); // State เก็บข้อมูลจริง
  const [loading, setLoading] = useState(true);
  const selectedDate = new Date().toISOString().split("T")[0];

  const fetchDailyRecords = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // ดึงข้อมูลเชื่อมตาราง daily_record -> record_item -> recipes (ไม่มี s แล้ว)
      const { data, error } = await supabase
        .from("daily_record")
        .select(`
          record_id,
          record_date,
          record_item (
            record_item_id,
            meal_type,
            recipe_id,
            recipe (
              recipe_id,
              name,
              image,
              recipe_nutrient!fk_nutrient_to_recipe (
                calories, protein, carbs, fat, sugar, sodium
              )
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("record_date", selectedDate)
        .maybeSingle();

      if (error) throw error;

      if (data && data.record_item) {
        setItems(data.record_item); // เอาข้อมูลอาหารจริงไปใส่ใน State
      } else {
        setItems([]); // ถ้าวันใหม่ยังไม่มีข้อมูล ให้เป็นอาร์เรย์ว่าง
      }
    } catch (error) {
      console.error("Error fetching daily records:", error);
    } finally {
      setLoading(false);
    }
  };
  useFocusEffect(
    useCallback(() => {
      fetchDailyRecords();
    }, [user, selectedDate])
  );

  const getNutrientValue = (recipeObj: any, key: string) => {
    if (!recipeObj?.recipe_nutrient) return 0;
    if (Array.isArray(recipeObj.recipe_nutrient)) {
      return Number(recipeObj.recipe_nutrient[0]?.[key] || 0);
    }
    return Number(recipeObj.recipe_nutrient?.[key] || 0);
  };

  const totalCalories = items.reduce((sum, item) => sum + getNutrientValue(item.recipe, "calories"), 0);
  const totalFat = items.reduce((sum, item) => sum + getNutrientValue(item.recipe, "fat"), 0);
  const totalProtein = items.reduce((sum, item) => sum + getNutrientValue(item.recipe, "protein"), 0);
  const totalCarbs = items.reduce((sum, item) => sum + getNutrientValue(item.recipe, "carbs"), 0);
  const totalSugar = items.reduce((sum, item) => sum + getNutrientValue(item.recipe, "sugar"), 0);
  const totalSodium = items.reduce((sum, item) => sum + getNutrientValue(item.recipe, "sodium"), 0);

  // 3. กรองข้อมูลเพื่อเช็กและแสดงผลในแต่ละช่องมื้ออาหาร
  const breakfast = items.find(i => i.meal_type === "breakfast");
  const lunch = items.find(i => i.meal_type === "lunch");
  const dinner = items.find(i => i.meal_type === "dinner");

  const handleMealPress = (mealType: "breakfast" | "lunch" | "dinner") => {
    router.push({
      pathname: "/(app)/(tabs)/record/searchOnTime",
      params: {
        meal_type: mealType,
        selected_date: selectedDate
      } // ส่งค่ามื้อเช้า/กลางวัน/เย็น ไปยังหน้า search
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ─── ส่วนที่ 1: Header ตัวสลับวันที่ ─── */}
        <View style={styles.dateHeader}>
          <TouchableOpacity style={styles.arrowBtn}>
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
          </TouchableOpacity>
          <View style={styles.dateDropdown}>
            <Text style={styles.dateText}>July</Text>
            <Ionicons name="caret-down" size={12} color="#007AFF" style={{ marginLeft: 4 }} />
          </View>
          <View style={styles.dateDropdown}>
            <Text style={styles.dateText}>8</Text>
            <Ionicons name="caret-down" size={12} color="#007AFF" style={{ marginLeft: 4 }} />
          </View>
          <TouchableOpacity style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={20} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconRight}>
            <Ionicons name="calendar-outline" size={22} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconRight}>
            <Ionicons name="menu-outline" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* ─── ส่วนที่ 2: Dashboard บน (Calorie & On Time) ─── */}
        <View style={styles.topDashboard}>

          {/* การ์ดฝั่งซ้าย: วงกลมแคลอรี */}
          <View style={styles.calorieCard}>
            <Text style={styles.cardTitle}>Calorie</Text>
            <View style={styles.circleOutline}>
              {/* ตัวเลขจะบวกรวมอัปเดตให้เองตรงนี้ */}
              <Text style={styles.circleNumber}>{totalCalories}</Text>
              <Text style={styles.circleUnit}>kcal</Text>
            </View>
          </View>

          {/* การ์ดฝั่งขวา: รายการมื้ออาหารล็อกช่องประจำเวลา */}
          <View style={styles.onTimeCard}>
            <Text style={styles.cardTitle}>On Time</Text>

            {/* 🥞 มื้อเช้า: เปลี่ยนเป็นปุ่มกด */}
            <TouchableOpacity style={styles.mealRow} onPress={() => handleMealPress("breakfast")}>
              <Image source={{ uri: breakfast ? breakfast.recipe.image : "https://via.placeholder.com/40" }} style={styles.mealThumb} />
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{breakfast ? breakfast.recipe.name : "Breakfast"}</Text>
              </View>
              {breakfast ? (
                <View style={styles.checkedCircle}><Ionicons name="checkmark" size={14} color="#34C759" /></View>
              ) : (
                <Ionicons name="add" size={18} color="#007AFF" /> // ➕ เปลี่ยนเป็นไอคอนบวกถ้ายังไม่มีอาหาร
              )}
            </TouchableOpacity>

            {/* 🍛 มื้อกลางวัน: เปลี่ยนเป็นปุ่มกด */}
            <TouchableOpacity style={styles.mealRow} onPress={() => handleMealPress("lunch")}>
              <Image source={{ uri: lunch ? lunch.recipe.image : "https://via.placeholder.com/40" }} style={styles.mealThumb} />
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{lunch ? lunch.recipe.name : "Lunch"}</Text>
              </View>
              {lunch ? (
                <View style={styles.checkedCircle}><Ionicons name="checkmark" size={14} color="#34C759" /></View>
              ) : (
                <Ionicons name="add" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>

            {/* 🍲 มื้อเย็น: เปลี่ยนเป็นปุ่มกด */}
            <TouchableOpacity style={styles.mealRow} onPress={() => handleMealPress("dinner")}>
              <Image source={{ uri: dinner ? dinner.recipe.image : "https://via.placeholder.com/40" }} style={styles.mealThumb} />
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{dinner ? dinner.recipe.name : "Dinner"}</Text>
              </View>
              {dinner ? (
                <View style={styles.checkedCircle}><Ionicons name="checkmark" size={14} color="#34C759" /></View>
              ) : (
                <Ionicons name="add" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── ส่วนที่ 3: แถบสีรายงานสารอาหารย่อย (Macro Lists) ─── */}
        <View style={styles.macroSection}>

          {/* แถบ Fat (สีดำ) */}
          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#000000" }]} />
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroValue}>{totalFat}/{TARGETS.fat}g</Text>
          </View>

          {/* แถบ Protein (สีน้ำเงิน) */}
          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#2F80ED" }]} />
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>{totalProtein}/{TARGETS.protein}g</Text>
          </View>

          {/* แถบ Carbs (สีส้ม) */}
          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#F2994A" }]} />
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroValue}>{totalCarbs}/{TARGETS.carbs}g</Text>
          </View>

          {/* แถบ Macro/Fiber (สีเขียว) */}
          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#27AE60" }]} />
            <Text style={styles.macroLabel}>Macro</Text>
            <Text style={styles.macroValue}>0/{TARGETS.protein}g</Text>
          </View>

          {/* แถบ Sugar (สีฟ้าพาสเทล) */}
          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#AADEF5" }]} />
            <Text style={styles.macroLabel}>Sugar</Text>
            <Text style={styles.macroValue}>{totalSugar}/{TARGETS.sugar}g</Text>
          </View>

          {/* แถบ Sodium (สีแดง) */}
          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#EB5757" }]} />
            <Text style={styles.macroLabel}>Sodium</Text>
            <Text style={styles.macroValue}>{totalSodium}/{TARGETS.sodium}g</Text>
          </View>

        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, paddingHorizontal: 20 },

  // Header Zone
  dateHeader: { flexDirection: "row", alignItems: "center", marginTop: 50, marginBottom: 25 },
  arrowBtn: { backgroundColor: "#F2F2F7", width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  dateDropdown: { flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginLeft: 8 },
  dateText: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  iconRight: { marginLeft: 16 },

  // Dashboard Zone
  topDashboard: { flexDirection: "row", justifyContent: "space-between", marginBottom: 25 },
  calorieCard: { backgroundColor: "#E9E9EE", width: "47%", borderRadius: 20, padding: 15, alignItems: "center", justifyContent: "center" },
  onTimeCard: { backgroundColor: "#E9E9EE", width: "49%", borderRadius: 20, padding: 12 },
  cardTitle: { fontSize: 14, color: "#666", alignSelf: "flex-start", marginBottom: 10 },

  // Calorie Circle
  circleOutline: { width: 105, height: 105, borderRadius: 52.5, borderWidth: 6, borderColor: "#007AFF", justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" },
  circleNumber: { fontSize: 22, fontWeight: "bold", color: "#333" },
  circleUnit: { fontSize: 12, color: "#888" },

  // Meal Rows inside On Time Card
  mealRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", padding: 6, borderRadius: 25, marginBottom: 6 },
  mealThumb: { width: 34, height: 34, borderRadius: 17, marginRight: 8 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 11, fontWeight: "600", color: "#333" },
  checkedCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center" },

  // Macros Zone
  macroSection: { marginTop: 5 },
  macroRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: "#F2F2F7" },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 15 },
  macroLabel: { fontSize: 16, fontWeight: "600", color: "#1A1A1A", flex: 1 },
  macroValue: { fontSize: 16, color: "#666", fontWeight: "500" }
});