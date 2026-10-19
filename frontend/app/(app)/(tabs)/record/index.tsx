import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Modal, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import { useFocusEffect } from "expo-router";
import { Calendar } from "react-native-calendars";
import Svg, { Circle } from "react-native-svg";
import { calculateTargets, parseTargetProfile } from "@/src/utils/nutritionTargets";

// เริ่มต้นที่ 3 มื้อ กดเพิ่มได้อีกสูงสุด 3 มื้อ (รวมแล้วไม่เกิน 6)
const DEFAULT_MEAL_SLOTS = 3;
const MAX_MEAL_SLOTS = 6;

// [ORANGE] พาเลตสีส้มของแอป (ใช้เฉพาะจุดเด่น ไม่ใช่ทั้งหน้า)
const ORANGE = "#F28E2B"; // สีหลัก (ปุ่ม/ไอคอน/progress)
const ORANGE_DARK = "#C96A0A"; // ตัวอักษรหัวข้อบนพื้นส้มอ่อน
const ORANGE_SOFT = "#FFEBD6"; // พื้นการ์ด
const ORANGE_LIGHT = "#FFF5EA"; // พื้นแถบวันที่ / เส้นแบ่ง
const ORANGE_TRACK = "#F9D5AE"; // รางของวงแหวน
const ORANGE_BORDER = "#F6C48F"; // เส้นประปุ่ม Add meal

// คำนวณสารอาหารจากวัตถุดิบ
const calculateRecipeNutrients = (recipeIngredients: any[], servingsCount: number = 1) => {
  const summary = { calories: 0, fat: 0, protein: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0 };

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
      } else if (name.includes("fiber")) {
        summary.fiber += calculatedAmount;
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
    fiber: summary.fiber / safeServings,
    sugar: summary.sugar / safeServings,
    sodium: summary.sodium / safeServings,
  };
};

export default function TrackingRecordScreen() {
  const router = useRouter();
  const { user, personalData } = useAuth();

  const [items, setItems] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  // เป้าหมายสารอาหารรายวัน คำนวณจาก personalData ใน AuthContext (ถ้าข้อมูลไม่ครบจะ fallback เป็นค่าเดิม)
  const targets = useMemo(
    () => calculateTargets(parseTargetProfile(personalData)),
    [personalData]
  );

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  // จำนวนมื้อที่แสดงอยู่ตอนนี้ เริ่มที่ 3 แล้วให้กด + เพิ่มเองได้
  const [mealSlots, setMealSlots] = useState(DEFAULT_MEAL_SLOTS);

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

  // ดึงข้อมูลจาก record_item 
  const fetchDailyRecords = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("record_item")
        .select(`
        record_item_id,
        record_date,
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
      `)
        .eq("user_id", user.id)
        .eq("record_date", selectedDate);

      if (error) throw error;

      if (data && Array.isArray(data)) {
        const formattedItems = data.map((item: any) => ({
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
      console.error("Error fetching records:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDailyRecords();
    }, [user, selectedDate])
  );

  // ถ้าเคยบันทึกมื้อที่ 4, 5, 6 ไว้ก่อนหน้านี้ ให้ขยายช่องให้ครบ จะได้ไม่หายไปจากหน้าจอ
  useEffect(() => {
    const highestRecordedMeal = items.reduce((max, item) => {
      const match = /Meal (\d+)/.exec(item.meal_type || "");
      const mealNumber = match ? parseInt(match[1], 10) : 0;
      return mealNumber > max ? mealNumber : max;
    }, 0);

    if (highestRecordedMeal > mealSlots) {
      setMealSlots(Math.min(highestRecordedMeal, MAX_MEAL_SLOTS));
    }
  }, [items]);

  // ลบมื้อที่กด "Add meal" เพิ่มมา - ลบได้แค่มื้อล่าสุด (undo การเพิ่ม) และห้ามลบต่ำกว่า 3 มื้อ default
  // ถ้ามื้อนั้นมีอาหารบันทึกไว้แล้ว ต้องถามยืนยันก่อน เพราะจะลบ record_item ทิ้งไปด้วย
  const handleRemoveMeal = (mealName: string) => {
    const mealItem = items.find(
      (i) => i.meal_type?.toLowerCase() === mealName.toLowerCase()
    );

    const removeSlot = () => setMealSlots((prev) => Math.max(DEFAULT_MEAL_SLOTS, prev - 1));

    if (!mealItem) {
      removeSlot();
      return;
    }

    Alert.alert(
      "Remove meal",
      `${mealName} already has food logged. Removing this slot will also delete that logged food. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("record_item")
                .delete()
                .eq("record_item_id", mealItem.record_item_id);
              if (error) throw error;

              setItems((prev) => prev.filter((i) => i.record_item_id !== mealItem.record_item_id));
              removeSlot();
            } catch (err) {
              console.error("Error removing meal:", err);
              Alert.alert("Error", "Could not remove this meal. Please try again.");
            }
          },
        },
      ]
    );
  };

  // ลบแค่อาหารที่เลือกไว้ในมื้อนั้น (เอาออกจาก record_item ใน Supabase) แต่ไม่ลบช่องมื้อทิ้ง
  // ใช้ได้กับทุกมื้อที่มีอาหารอยู่แล้ว ต่างจาก handleRemoveMeal ที่ลบทั้งช่อง
  const handleDeleteFood = (mealItem: any, mealName: string) => {
    Alert.alert(
      "Remove food",
      `Remove "${mealItem.recipe?.recipe_name || "this food"}" from ${mealName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("record_item")
                .delete()
                .eq("record_item_id", mealItem.record_item_id);
              if (error) throw error;

              setItems((prev) => prev.filter((i) => i.record_item_id !== mealItem.record_item_id));
            } catch (err) {
              console.error("Error removing food:", err);
              Alert.alert("Error", "Could not remove this food. Please try again.");
            }
          },
        },
      ]
    );
  };

  // 3. ปรับการคำนวณผลรวมสารอาหารให้ดึงจาก calculatedNutrients
  const totalCalories = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.calories || 0), 0));
  const totalFat = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.fat || 0), 0));
  const totalProtein = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.protein || 0), 0));
  const totalCarbs = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.carbs || 0), 0));
  const totalFiber = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.fiber || 0), 0));
  const totalSugar = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.sugar || 0), 0));
  const totalSodium = Math.round(items.reduce((sum, item) => sum + (item.calculatedNutrients?.sodium || 0), 0));

  // ค่าที่ใช้วาด progress ring ของ Calories
  const RING_SIZE = 105;
  const RING_STROKE = 8;
  const ringRadius = (RING_SIZE - RING_STROKE) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const caloriePercentage = Math.min(100, (totalCalories / targets.calories) * 100);
  const ringStrokeDashoffset = ringCircumference - (caloriePercentage / 100) * ringCircumference;
  const caloriesRemaining = Math.max(0, targets.calories - totalCalories);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" }}>
        <ActivityIndicator size="large" color={ORANGE} />
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
              <Ionicons name="chevron-back" size={24} color={ORANGE} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateSelectButton}
              onPress={() => setIsCalendarVisible(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={ORANGE} style={{ marginRight: 6 }} />
              <Text style={styles.dateDisplayTitle}>
                {selectedDate === new Date().toISOString().split("T")[0] ? "Today " : ""}
                ({selectedDate})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.arrowButton} onPress={() => changeDate(1)}>
              <Ionicons name="chevron-forward" size={24} color={ORANGE} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.chartButton}
            onPress={() => router.push("/(app)/(tabs)/record/chart")}
          >
            <Ionicons name="analytics-outline" size={22} color="#FFFFFF" />
            <Text style={styles.chartButtonLabel}>Stats</Text>
          </TouchableOpacity>
        </View>

        {/* ส่วนที่ 2: Dashboard (Meals On Time ด้านบน / Calories ด้านล่าง) */}
        <View style={styles.topDashboard}>

          {/* Meals On Time */}
          <View style={styles.onTimeCard}>
            <Text style={styles.cardTitle}>Meals On Time</Text>

            {/* แสดงรายการมื้อตามจำนวน mealSlots ปัจจุบัน เริ่มที่ 3 แล้วกด + เพิ่มเองได้ */}
            {Array.from({ length: mealSlots }, (_, i) => `Meal ${i + 1}`).map((mealName, index) => {
              // หาอาหารรายการแรกของมื้อนี้ (ถ้ามี)
              const mealItem = items.find(
                (i) => i.meal_type?.toLowerCase() === mealName.toLowerCase()
              );

              // ลบได้แค่มื้อล่าสุดที่เพิ่มมา (เกินจาก 3 มื้อ default) เท่านั้น กันปัญหาเลขมื้อสลับกัน
              const canRemove = mealSlots > DEFAULT_MEAL_SLOTS && index === mealSlots - 1;

              return (
                <TouchableOpacity
                  key={mealName}
                  style={styles.mealRow}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/(tabs)/record/searchOnTime",
                      params: {
                        meal_type: mealName,
                        selected_date: selectedDate,
                      },
                    })
                  }
                >
                  <Image
                    source={{
                      uri:
                        mealItem?.recipe?.img ||
                        "https://via.placeholder.com/40",
                    }}
                    style={styles.mealThumb}
                  />
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName}>
                      {mealItem?.recipe?.recipe_name || mealName}
                    </Text>
                  </View>
                  {mealItem ? (
                    <View style={styles.mealDoneActions}>
                      <View style={styles.checkedCircle}>
                        <Ionicons name="checkmark" size={14} color="#34C759" />
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteFood(mealItem, mealName)}
                        style={styles.deleteFoodBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Ionicons name="add" size={18} color={ORANGE} />
                  )}
                  {canRemove && (
                    <TouchableOpacity
                      onPress={() => handleRemoveMeal(mealName)}
                      style={styles.removeMealBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* ปุ่มเพิ่มมื้อ - กดได้จนกว่าจะครบ 6 มื้อ */}
            {mealSlots < MAX_MEAL_SLOTS && (
              <TouchableOpacity
                style={styles.addMealRow}
                onPress={() => setMealSlots((prev) => prev + 1)}
              >
                <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
                <Text style={styles.addMealText}>Add meal</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Calories */}
          <View style={styles.calorieCard}>
            <Text style={styles.cardTitle}>Calories</Text>
            <View style={styles.circleWrapper}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={ringRadius}
                  stroke={ORANGE_TRACK}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={ringRadius}
                  stroke={ORANGE}
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${ringCircumference}, ${ringCircumference}`}
                  strokeDashoffset={ringStrokeDashoffset}
                  rotation="-90"
                  origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                />
              </Svg>
              <View style={styles.circleTextOverlay}>
                <Text style={styles.circleNumber}>{totalCalories}</Text>
                <Text style={styles.circleUnit}>kcal</Text>
              </View>
            </View>
            <Text style={styles.calorieRemainingText}>
              {caloriesRemaining} kcal left of {targets.calories}
            </Text>
          </View>
        </View>

        {/* ส่วนที่ 3: แถบแสดง nutrient */}
        <View style={styles.macroSection}>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#000000" }]} />
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroValue}>{totalFat}/{targets.fat}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#2F80ED" }]} />
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>{totalProtein}/{targets.protein}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#F2994A" }]} />
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroValue}>{totalCarbs}/{targets.carbs}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#27AE60" }]} />
            <Text style={styles.macroLabel}>Fiber</Text>
            <Text style={styles.macroValue}>{totalFiber}/{targets.fiber}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#AADEF5" }]} />
            <Text style={styles.macroLabel}>Sugar</Text>
            <Text style={styles.macroValue}>{totalSugar}/{targets.sugar}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#EB5757" }]} />
            <Text style={styles.macroLabel}>Sodium</Text>
            <Text style={styles.macroValue}>{totalSodium}/{targets.sodium}mg</Text>
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
                  [selectedDate]: { selected: true, selectedColor: ORANGE, selectedTextColor: "white" }
                }}
                theme={{
                  todayTextColor: ORANGE,
                  arrowColor: ORANGE,
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

  // Dashboard Zone - เรียงเป็นแนวตั้ง: Meals On Time อยู่บน, Calories อยู่ล่าง
  topDashboard: { flexDirection: "column", marginBottom: 25 },
  calorieCard: { backgroundColor: ORANGE_SOFT, width: "100%", borderRadius: 20, padding: 15, alignItems: "center", justifyContent: "center", marginTop: 15 },
  onTimeCard: { backgroundColor: ORANGE_SOFT, width: "100%", borderRadius: 20, padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: ORANGE_DARK, alignSelf: "flex-start", marginBottom: 10 },

  // Calorie Circle
  circleWrapper: { width: 105, height: 105, justifyContent: "center", alignItems: "center" },
  circleTextOverlay: { position: "absolute", justifyContent: "center", alignItems: "center" },
  circleNumber: { fontSize: 22, fontWeight: "bold", color: "#333" },
  circleUnit: { fontSize: 12, color: "#888" },
  calorieRemainingText: { fontSize: 12, color: "#666", marginTop: 10 },

  // Meal Rows inside On Time Card
  mealRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", padding: 8, borderRadius: 26, marginBottom: 8 },
  mealThumb: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 13, fontWeight: "600", color: "#333" },
  checkedCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center" },
  mealDoneActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  deleteFoodBtn: { padding: 2 },
  removeMealBtn: { marginLeft: 8, padding: 2 },
  addMealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: ORANGE_BORDER,
    borderRadius: 25,
    paddingVertical: 8,
    marginTop: 2,
  },
  addMealText: { fontSize: 12, fontWeight: "600", color: ORANGE, marginLeft: 6 },

  // Macros Zone
  macroSection: { marginTop: 5 },
  macroRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: ORANGE_LIGHT },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 15 },
  macroLabel: { fontSize: 16, fontWeight: "600", color: "#1A1A1A", flex: 1 },
  macroValue: { fontSize: 16, color: "#666", fontWeight: "500" },
  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: ORANGE_LIGHT,
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
    backgroundColor: ORANGE_LIGHT,
    borderRadius: 12,
    alignItems: "center",
  },
  closeCalendarText: {
    fontSize: 14,
    fontWeight: "600",
    color: ORANGE_DARK,
  },
  chartButton: {
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    marginTop: 5,
    minWidth: 54,
  },
  chartButtonLabel: { fontSize: 10, fontWeight: "600", color: "#FFFFFF", marginTop: 3 },
});