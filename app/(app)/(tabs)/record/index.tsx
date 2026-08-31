import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import { useFocusEffect } from "expo-router";
import { Calendar } from "react-native-calendars";

// กำหนดเป้าหมายสารอาหารแต่ละวัน
const TARGETS = { calories: 2000, fat: 65, protein: 60, carbs: 300, sugar: 50, sodium: 2000 };

// 1. ฟังก์ชันคำนวณสารอาหารจากวัตถุดิบ
const calculateRecipeNutrients = (recipeIngredients: any[], servingsCount: number = 1) => {
  const summary = { calories: 0, fat: 0, protein: 0, carbs: 0, sugar: 0, sodium: 0 };

  // ป้องกันกรณี serving เป็น 0 หรือ null
  const safeServings = servingsCount > 0 ? servingsCount : 1;

  // วนลูปผ่านวัตถุดิบแต่ละตัวของสูตรอาหาร
  recipeIngredients?.forEach((ri) => {
    const weightG = ri.weight_g || 0;
    const ingredientNutrients = ri.ingredients?.ingredient_nutrients || [];

    // วนลูปผ่านสารอาหารแต่ละตัวของวัตถุดิบ
    ingredientNutrients.forEach((item: any) => {
      const name = item.nutrients?.nutrient_name?.toLowerCase() || "";
      const baseAmount = item.amount || 0;

      const calculatedAmount = (weightG / 100) * baseAmount;

      if (name.includes("calorie") || name.includes("energy")) {
        summary.calories += calculatedAmount;
      } else if (name.includes("fat")) {
        summary.fat += calculatedAmount;
      } else if (name.includes("protein")) {
        summary.protein += calculatedAmount;
      } else if (name.includes("carb")) {
        summary.carbs += calculatedAmount;
      } else if (name.includes("sugar")) {
        summary.sugar += calculatedAmount;
      } else if (name.includes("sodium")) {
        summary.sodium += calculatedAmount;
      }
    });
  });

  return {
    calories: summary.calories / safeServings,
    fat: summary.fat / safeServings,
    protein: summary.protein / safeServings,
    carbs: summary.carbs / safeServings,
    sugar: summary.sugar / safeServings,
    sodium: summary.sodium / safeServings,
  };
};

export default function TrackingRecordScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<any[]>([]); // State เก็บข้อมูลจริง
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  // ฟังก์ชันเปลี่ยนวัน
  const changeDate = (daysToShift: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + daysToShift);
    // ป้องกันไม่ให้เลือกวันในอนาคต
    const formattedDate = current.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    if (daysToShift > 0 && formattedDate > todayStr) {
      return;
    }
    setSelectedDate(formattedDate);
  };

  // 2. ดึงข้อมูล Daily Records และแมปค่าที่คำนวณได้ใส่ลงใน State
  const fetchDailyRecords = async () => {
  if (!user) return;
  try {
    setLoading(true);

    const { data, error } = await supabase
      .from("daily_record")
      .select(`
        record_id,
        record_date,
        record_item (
          record_item_id,
          meal_type,
          recipe_id,
          recipe:recipes (
            recipe_id,
            recipe_name,
            img,
            serving,
            recipe_ingredients (
              recipe_ingredient_id,
              weight_g,
              ingredients (
                ingredient_id,
                ingredient_nutrients (
                  amount,
                  nutrients (
                    nutrient_id,
                    nutrient_name,
                    nutrient_unit
                  )
                )
              )
            )
          )
        )
      `)
      .eq("user_id", user.id)
      .eq("record_date", selectedDate)
      .maybeSingle();

    if (error) throw error;

    const recordItems = (data as any)?.record_item;

    if (recordItems && Array.isArray(recordItems)) {
      const formattedItems = recordItems.map((item: any) => ({
        ...item,
        calculatedNutrients: calculateRecipeNutrients(
          item.recipe?.recipe_ingredients || [],
          item.recipe?.serving || 1
        )
      }));
      setItems(formattedItems);
    } else {
      setItems([]);
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

  // 3. ปรับการคำนวณผลรวมสารอาหารให้ดึงจาก calculatedNutrients
  const totalCalories = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.calories || 0), 0));
  const totalFat = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.fat || 0), 0));
  const totalProtein = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.protein || 0), 0));
  const totalCarbs = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.carbs || 0), 0));
  const totalSugar = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.sugar || 0), 0));
  const totalSodium = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.sodium || 0), 0));

  // กรองข้อมูลมื้ออาหาร
  const breakfast = items.find(i => i.meal_type === "breakfast");
  const lunch = items.find(i => i.meal_type === "lunch");
  const dinner = items.find(i => i.meal_type === "dinner");

  const handleMealPress = (mealType: "breakfast" | "lunch" | "dinner") => {
    router.push({
      pathname: "/(app)/(tabs)/record/searchOnTime",
      params: {
        meal_type: mealType,
        selected_date: selectedDate
      }
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

        {/* ส่วนที่ 1: Header ตัวสลับวันที่ */}
        <View style={styles.dateHeader}>
          <View style={styles.datePickerContainer}>
            <TouchableOpacity style={styles.arrowButton} onPress={() => changeDate(-1)}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateSelectButton}
              onPress={() => setIsCalendarVisible(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#007AFF" style={{ marginRight: 6 }} />
              <Text style={styles.dateDisplayTitle}>
                {selectedDate === new Date().toISOString().split("T")[0] ? "Today " : ""}
                ({selectedDate})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.arrowButton} onPress={() => changeDate(1)}>
              <Ionicons name="chevron-forward" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => router.push("/(app)/(tabs)/record/chart")}
          >
            <Ionicons name="analytics-outline" size={28} color="#333333" />
          </TouchableOpacity>
        </View>

        {/* ส่วนที่ 2: Dashboard (Calories & On Time) */}
        <View style={styles.topDashboard}>

          {/* ฝั่งซ้าย: calories */}
          <View style={styles.calorieCard}>
            <Text style={styles.cardTitle}>Calories</Text>
            <View style={styles.circleOutline}>
              <Text style={styles.circleNumber}>{totalCalories}</Text>
              <Text style={styles.circleUnit}>kcal</Text>
            </View>
          </View>

          {/* ฝั่งขวา: On Time */}
          <View style={styles.onTimeCard}>
            <Text style={styles.cardTitle}>On Time</Text>

            {/* breakfast */}
            <TouchableOpacity style={styles.mealRow} onPress={() => handleMealPress("breakfast")}>
              <Image source={{ uri: breakfast?.recipe?.img || "https://via.placeholder.com/40" }} style={styles.mealThumb} />
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{breakfast?.recipe?.recipe_name || "Breakfast"}</Text>
              </View>
              {breakfast ? (
                <View style={styles.checkedCircle}><Ionicons name="checkmark" size={14} color="#34C759" /></View>
              ) : (
                <Ionicons name="add" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>

            {/* lunch */}
            <TouchableOpacity style={styles.mealRow} onPress={() => handleMealPress("lunch")}>
              <Image source={{ uri: lunch?.recipe?.img || "https://via.placeholder.com/40" }} style={styles.mealThumb} />
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{lunch?.recipe?.recipe_name || "Lunch"}</Text>
              </View>
              {lunch ? (
                <View style={styles.checkedCircle}><Ionicons name="checkmark" size={14} color="#34C759" /></View>
              ) : (
                <Ionicons name="add" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>

            {/* dinner */}
            <TouchableOpacity style={styles.mealRow} onPress={() => handleMealPress("dinner")}>
              <Image source={{ uri: dinner?.recipe?.img || "https://via.placeholder.com/40" }} style={styles.mealThumb} />
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{dinner?.recipe?.recipe_name || "Dinner"}</Text>
              </View>
              {dinner ? (
                <View style={styles.checkedCircle}><Ionicons name="checkmark" size={14} color="#34C759" /></View>
              ) : (
                <Ionicons name="add" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ส่วนที่ 3: แถบแสดง nutrient */}
        <View style={styles.macroSection}>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#000000" }]} />
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroValue}>{totalFat}/{TARGETS.fat}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#2F80ED" }]} />
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>{totalProtein}/{TARGETS.protein}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#F2994A" }]} />
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroValue}>{totalCarbs}/{TARGETS.carbs}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#27AE60" }]} />
            <Text style={styles.macroLabel}>Macro</Text>
            <Text style={styles.macroValue}>0/{TARGETS.protein}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#AADEF5" }]} />
            <Text style={styles.macroLabel}>Sugar</Text>
            <Text style={styles.macroValue}>{totalSugar}/{TARGETS.sugar}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#EB5757" }]} />
            <Text style={styles.macroLabel}>Sodium</Text>
            <Text style={styles.macroValue}>{totalSodium}/{TARGETS.sodium}g</Text>
          </View>

        </View>

        <View style={{ height: 100 }} />

        {/* ส่วนที่ 4: ปฏิทินเลือกวัน */}
        <Modal
          visible={isCalendarVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsCalendarVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsCalendarVisible(false)}
          >
            <View style={styles.calendarCard}>
              <Text style={styles.calendarModalTitle}>Select Date</Text>

              <Calendar
                current={selectedDate}
                maxDate={new Date().toISOString().split("T")[0]}
                onDayPress={(day) => {
                  setSelectedDate(day.dateString);
                  setIsCalendarVisible(false);
                }}
                markedDates={{
                  [selectedDate]: { selected: true, selectedColor: "#007AFF", selectedTextColor: "white" }
                }}
                theme={{
                  todayTextColor: "#007AFF",
                  arrowColor: "#007AFF",
                  textDayFontWeight: "500",
                }}
              />

              <TouchableOpacity
                style={styles.closeCalendarBtn}
                onPress={() => setIsCalendarVisible(false)}
              >
                <Text style={styles.closeCalendarText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, paddingHorizontal: 20 },

  // Header Zone
  dateHeader: { flexDirection: "row", alignItems: "center", marginTop: 25, marginBottom: 25 },
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
  macroValue: { fontSize: 16, color: "#666", fontWeight: "500" },
  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F2F2F7",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 15,
    flex: 1,
    marginTop: 15,
    marginBottom: 10,
  },
  arrowButton: {
    padding: 5,
  },
  dateDisplayTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  dateSelectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  calendarModalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 15,
  },
  closeCalendarBtn: {
    marginTop: 15,
    paddingVertical: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    alignItems: "center",
  },
  closeCalendarText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF3B30",
  },
  hamburgerButton: {
    backgroundColor: "#F2F2F7",
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    marginTop: 5,
  },
});