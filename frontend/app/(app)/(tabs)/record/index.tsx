import { useState, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import { Calendar } from "react-native-calendars";
import Svg, { Circle } from "react-native-svg";
import { DEFAULT_TARGETS, type Targets } from "@/src/utils/nutritionTargets";
import { MEAL_TYPES, MEAL_LABEL } from "@/src/api/record";
import { localDateString } from "@/src/utils/date";
import { openRecipeInForum } from "@/src/utils/openRecipe";

const ORANGE = "#F28E2B";
const ORANGE_DARK = "#C96A0A";
const ORANGE_SOFT = "#FFEBD6";
const ORANGE_LIGHT = "#FFF5EA";
const ORANGE_TRACK = "#F9D5AE";

const mapRecipeFeatures = (features: any) => {
  const f = Array.isArray(features) ? features[0] : features;
  const num = (v: any) => Number(v) || 0;

  return {
    calories: num(f?.calories),
    fat: num(f?.total_fat),
    protein: num(f?.protein),
    carbs: num(f?.carb),
    fiber: num(f?.fiber),
    sugar: num(f?.sugar),
    sodium: num(f?.sodium),
  };
};

const getFirstImage = (img: any): string | null => {
  let value = img;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      value = JSON.parse(value);
    } catch {}
  }
  if (Array.isArray(value)) {
    return (
      value.find((u: any) => typeof u === "string" && u.length > 0) || null
    );
  }
  return typeof value === "string" && value.length > 0 ? value : null;
};

export default function TrackingRecordScreen() {
  const router = useRouter();
  const { user, personalData } = useAuth();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Targets>(DEFAULT_TARGETS);
  const [selectedDate, setSelectedDate] = useState<string>(localDateString());
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  const changeDate = (daysToShift: number) => {
    // build from y/m/d parts so the shift stays in the user's local calendar (no UTC drift)
    const [y, m, d] = selectedDate.split("-").map(Number);
    const formattedDate = localDateString(new Date(y, m - 1, d + daysToShift));
    const todayStr = localDateString();

    if (daysToShift > 0 && formattedDate > todayStr) {
      return;
    }
    setSelectedDate(formattedDate);
  };

  // Only today can be changed; older days are read-only (the database enforces this too)
  const isToday = selectedDate === localDateString();

  const fetchTargets = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_daily_targets")
        .select("kcal, protein_g, fat_g, carbs_g, fiber_g, sugar_g, sodium_mg")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      setTargets(
        data
          ? {
              calories: Number(data.kcal),
              protein: Number(data.protein_g),
              fat: Number(data.fat_g),
              carb: Number(data.carbs_g),
              fiber: Number(data.fiber_g),
              sugar: Number(data.sugar_g),
              sodium: Number(data.sodium_mg),
            }
          : DEFAULT_TARGETS,
      );
    } catch (error) {
      console.error("Error fetching daily targets:", error);
      setTargets(DEFAULT_TARGETS);
    }
  };

  const fetchDailyRecords = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("record_item")
        .select(
          `
        record_item_id,
        record_date,
        meal_type,
        recipe_id,
        recipe:recipes (
          recipe_id,
          recipe_name,
          img,
          serving,
          recipe_features (
            calories,
            protein,
            sugar,
            total_fat,
            carb,
            fiber,
            sodium
          )
        )
      `,
        )
        .eq("user_id", user.id)
        .eq("record_date", selectedDate);

      if (error) throw error;

      if (data && Array.isArray(data)) {
        const formattedItems = data.map((item: any) => ({
          ...item,
          calculatedNutrients: mapRecipeFeatures(item.recipe?.recipe_features),
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
    }, [user, selectedDate]),
  );

  useFocusEffect(
    useCallback(() => {
      fetchTargets();
    }, [user, personalData]),
  );

  // กดปุ่ม + แล้วนำไปหน้า searchOnTime ทันที พร้อมส่งค่า meal_type ไปด้วย
  const handleAddFoodDirect = (
    mealType: (typeof MEAL_TYPES)[number] = "breakfast",
  ) => {
    router.push({
      pathname: "/(app)/(tabs)/record/searchOnTime",
      params: { meal_type: mealType, selected_date: selectedDate },
    });
  };

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
              const { data: removed, error } = await supabase
                .from("record_item")
                .delete()
                .eq("record_item_id", mealItem.record_item_id)
                .select("record_item_id");
              if (error) throw error;
              if (!removed || removed.length === 0) {
                Alert.alert("Can't remove", "Past records can't be changed.");
                return;
              }

              setItems((prev) =>
                prev.filter(
                  (i) => i.record_item_id !== mealItem.record_item_id,
                ),
              );
            } catch (err) {
              console.error("Error removing food:", err);
              Alert.alert(
                "Error",
                "Could not remove this food. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const totalCalories = Math.round(
    items.reduce(
      (sum, item) => sum + (item.calculatedNutrients?.calories || 0),
      0,
    ),
  );
  const totalFat = Math.round(
    items.reduce((sum, item) => sum + (item.calculatedNutrients?.fat || 0), 0),
  );
  const totalProtein = Math.round(
    items.reduce(
      (sum, item) => sum + (item.calculatedNutrients?.protein || 0),
      0,
    ),
  );
  const totalCarbs = Math.round(
    items.reduce(
      (sum, item) => sum + (item.calculatedNutrients?.carbs || 0),
      0,
    ),
  );
  const totalFiber = Math.round(
    items.reduce(
      (sum, item) => sum + (item.calculatedNutrients?.fiber || 0),
      0,
    ),
  );
  const totalSugar = Math.round(
    items.reduce(
      (sum, item) => sum + (item.calculatedNutrients?.sugar || 0),
      0,
    ),
  );
  const totalSodium = Math.round(
    items.reduce(
      (sum, item) => sum + (item.calculatedNutrients?.sodium || 0),
      0,
    ),
  );

  const RING_SIZE = 105;
  const RING_STROKE = 8;
  const ringRadius = (RING_SIZE - RING_STROKE) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const caloriePercentage = Math.min(
    100,
    (totalCalories / targets.calories) * 100,
  );
  const ringStrokeDashoffset =
    ringCircumference - (caloriePercentage / 100) * ringCircumference;
  const caloriesRemaining = Math.max(0, targets.calories - totalCalories);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFF",
        }}
      >
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
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => changeDate(-1)}
            >
              <Ionicons name="chevron-back" size={24} color={ORANGE} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateSelectButton}
              onPress={() => setIsCalendarVisible(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={ORANGE}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.dateDisplayTitle}>
                {isToday ? "Today " : ""}({selectedDate})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => changeDate(1)}
            >
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

        {/* ส่วนที่ 2: Dashboard */}
        <View style={styles.topDashboard}>
          {/* Meals On Time Card */}
          <View style={styles.onTimeCard}>
            <View style={styles.onTimeCardHeader}>
              <Text style={styles.cardTitle}>Meals On Time</Text>
              {isToday && (
                <TouchableOpacity
                  style={styles.addFoodInlineBtn}
                  onPress={() => handleAddFoodDirect()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
            {!isToday && (
              <Text style={styles.readOnlyNote}>
                Past days are read-only. Tap a meal to view its recipe.
              </Text>
            )}

            {MEAL_TYPES.map((mealType) => {
              const mealItems = items.filter(
                (item) => item.meal_type?.toLowerCase() === mealType,
              );
              const mealLabel = MEAL_LABEL[mealType];

              return (
                <View key={mealType} style={styles.mealGroup}>
                  <Text style={styles.mealGroupTitle}>{mealLabel}</Text>

                  {/* เงื่อนไข: ถ้ายังไม่มีเมนูในมื้อนี้ ให้แสดงข้อความแจ้งเตือน */}
                  {mealItems.length === 0 ? (
                    <View style={styles.emptyMealRow}>
                      <Text style={styles.emptyMealText}>
                        no menu for {mealLabel.toLowerCase()}.
                      </Text>
                    </View>
                  ) : (
                    mealItems.map((mealItem) => (
                      <TouchableOpacity
                        key={mealItem.record_item_id}
                        style={styles.mealRow}
                        activeOpacity={0.7}
                        onPress={() =>
                          openRecipeInForum(router, mealItem.recipe_id)
                        }
                      >
                        <Image
                          source={{
                            uri:
                              getFirstImage(mealItem.recipe?.img) ||
                              "https://via.placeholder.com/40",
                          }}
                          style={styles.mealThumb}
                        />
                        <View style={styles.mealInfo}>
                          <Text style={styles.mealName}>
                            {mealItem.recipe?.recipe_name || "Food"}
                          </Text>
                        </View>
                        <View style={styles.mealDoneActions}>
                          <View style={styles.checkedCircle}>
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="#34C759"
                            />
                          </View>
                          {isToday ? (
                            <TouchableOpacity
                              onPress={() =>
                                handleDeleteFood(mealItem, mealLabel)
                              }
                              style={styles.deleteFoodBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons
                                name="close-circle-outline"
                                size={20}
                                color="#FF3B30"
                              />
                            </TouchableOpacity>
                          ) : (
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color="#C7C7CC"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              );
            })}
          </View>

          {/* Calories Card */}
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

        {/* ส่วนที่ 3: แถบสารอาหาร */}
        <View style={styles.macroSection}>
          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#000000" }]} />
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroValue}>
              {totalFat}/{targets.fat}g
            </Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#2F80ED" }]} />
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>
              {totalProtein}/{targets.protein}g
            </Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#F2994A" }]} />
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroValue}>
              {totalCarbs}/{targets.carb}g
            </Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#27AE60" }]} />
            <Text style={styles.macroLabel}>Fiber</Text>
            <Text style={styles.macroValue}>
              {totalFiber}/{targets.fiber}g
            </Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#AADEF5" }]} />
            <Text style={styles.macroLabel}>Sugar</Text>
            <Text style={styles.macroValue}>
              {totalSugar}/{targets.sugar}g
            </Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.colorDot, { backgroundColor: "#EB5757" }]} />
            <Text style={styles.macroLabel}>Sodium</Text>
            <Text style={styles.macroValue}>
              {totalSodium}/{targets.sodium}mg
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />

        {/* Modal เลือกวัน */}
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
                maxDate={localDateString()}
                onDayPress={(day) => {
                  setSelectedDate(day.dateString);
                  setIsCalendarVisible(false);
                }}
                markedDates={{
                  [selectedDate]: {
                    selected: true,
                    selectedColor: ORANGE,
                    selectedTextColor: "white",
                  },
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

  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 25,
    marginBottom: 15,
  },

  topDashboard: { flexDirection: "column", marginBottom: 25 },
  calorieCard: {
    backgroundColor: ORANGE_SOFT,
    width: "100%",
    borderRadius: 20,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  onTimeCard: {
    backgroundColor: ORANGE_SOFT,
    width: "100%",
    borderRadius: 20,
    padding: 15,
  },

  onTimeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: ORANGE_DARK },
  addFoodInlineBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ORANGE,
    justifyContent: "center",
    alignItems: "center",
  },

  circleWrapper: {
    width: 105,
    height: 105,
    justifyContent: "center",
    alignItems: "center",
  },
  circleTextOverlay: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  circleNumber: { fontSize: 22, fontWeight: "bold", color: "#333" },
  circleUnit: { fontSize: 12, color: "#888" },
  calorieRemainingText: { fontSize: 12, color: "#666", marginTop: 10 },

  mealGroup: { marginBottom: 12 },
  mealGroupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: ORANGE_DARK,
    marginBottom: 7,
    marginTop: 2,
  },

  // สไตล์สำหรับกล่องข้อความเมื่อยังไม่มีเมนูในมื้อนั้น
  emptyMealRow: {
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyMealText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    fontWeight: "500",
  },

  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 8,
    borderRadius: 26,
    marginBottom: 8,
  },
  mealThumb: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 13, fontWeight: "600", color: "#333" },
  checkedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
  },
  mealDoneActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  deleteFoodBtn: { padding: 2 },
  readOnlyNote: { fontSize: 12, color: "#8E8E93", marginBottom: 8 },

  macroSection: { marginTop: 5 },
  macroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: ORANGE_LIGHT,
  },
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
  },
  arrowButton: { padding: 5 },
  dateDisplayTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
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
  closeCalendarText: { fontSize: 14, fontWeight: "600", color: ORANGE_DARK },
  chartButton: {
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  chartButtonLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 2,
  },
});
