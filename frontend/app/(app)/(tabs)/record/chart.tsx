import { useState, useCallback } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

// ฟังก์ชันคำนวณหาแคลอรีรวมจากวัตถุดิบจริง และหารด้วยจำนวน serving ของสูตรอาหาร
const calculateRecipeCalories = (recipeIngredients: any[], servingCount: number = 1) => {
  let totalCal = 0;
  recipeIngredients?.forEach((ri) => {
    const weightG = ri.weight_g || 0;
    const ingredientNutrients = ri.ingredients?.ingredient_nutrients || [];

    ingredientNutrients.forEach((item: any) => {
      const name = item.nutrients?.nutrient_name?.toLowerCase() || "";
      const baseAmount = item.amount || 0;

      // ถ้าชื่อเป็นแคลอรีหรือพลังงาน ให้คำนวณตามน้ำหนักวัตถุดิบ
      if (name.includes("calorie") || name.includes("energy")) {
        totalCal += (weightG / 100) * baseAmount;
      }
    });
  });

  // ป้องกันกรณี serving เป็น 0 หรือ null
  const safeServings = servingCount > 0 ? servingCount : 1;

  // หารด้วยจำนวน serving เพื่อคิดแคลอรีต่อ 1 Serving
  return totalCal / safeServings;
};

// ===== [BMI] การ์ด BMI (คำนวณจากน้ำหนัก/ส่วนสูง ไม่มี column bmi) =====
// สีหลักของแอป
const ORANGE = "#F28E2B";

// ช่วงของแถบสเกล (ค่า BMI ที่ต่ำ/สูงกว่านี้จะถูกตรึงไว้ที่ขอบ)
const SCALE_MIN = 15;
const SCALE_MAX = 35;

// เกณฑ์สำหรับคนเอเชีย/ไทย ถ้าอยากใช้เกณฑ์ WHO ให้เปลี่ยน 23 -> 25 และ 25 -> 30
const SEGMENTS = [
  { label: "Underweight", from: 15, to: 18.5, color: "#3B82F6" },
  { label: "Normal", from: 18.5, to: 23, color: "#34C759" },
  { label: "Overweight", from: 23, to: 25, color: ORANGE },
  { label: "Obese", from: 25, to: 35, color: "#FF3B30" },
];

const getCategory = (bmi: number) => {
  if (bmi < 18.5) return SEGMENTS[0];
  if (bmi < 23) return SEGMENTS[1];
  if (bmi < 25) return SEGMENTS[2];
  return SEGMENTS[3];
};

type Props = {
  weightKg?: number | null;
  heightCm?: number | null;
};

function BmiCard({ weightKg, heightCm }: Props) {
  const weight = Number(weightKg);
  const heightM = Number(heightCm) / 100;

  // ถ้ายังไม่มีน้ำหนัก/ส่วนสูง ให้แสดงข้อความแทน
  if (!weight || !heightM) {
    return (
      <View style={bmiStyles.card}>
        <Text style={bmiStyles.title}>BMI</Text>
        <Text style={bmiStyles.emptyText}>Add your weight and height in Personal Data to see your BMI</Text>
      </View>
    );
  }

  const bmi = weight / (heightM * heightM);
  const category = getCategory(bmi);

  // ตำแหน่งตัวชี้บนแถบ (เป็น % ของความกว้าง)
  const clamped = Math.min(Math.max(bmi, SCALE_MIN), SCALE_MAX);
  const pointerLeft = ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

  return (
    <View style={bmiStyles.card}>
      <View style={bmiStyles.headerRow}>
        <Text style={bmiStyles.title}>BMI</Text>
        <View style={[bmiStyles.chip, { backgroundColor: category.color + "22" }]}>
          <Text style={[bmiStyles.chipText, { color: category.color }]}>{category.label}</Text>
        </View>
      </View>

      <Text style={bmiStyles.bmiValue}>{bmi.toFixed(1)}</Text>

      {/* แถบสเกล: ความกว้างของแต่ละช่วงเป็นสัดส่วนตามช่วง BMI จริง */}
      <View style={bmiStyles.scaleWrapper}>
        <View style={bmiStyles.scaleBar}>
          {SEGMENTS.map((s) => (
            <View
              key={s.label}
              style={{ flex: s.to - s.from, backgroundColor: s.color, opacity: s === category ? 1 : 0.35 }}
            />
          ))}
        </View>

        {/* ตัวชี้ตำแหน่ง BMI */}
        <View style={[bmiStyles.pointer, { left: `${pointerLeft}%` }]} />
      </View>

      {/* ตัวเลขขอบเขตแต่ละช่วง วางตามตำแหน่งจริงบนแถบ */}
      <View style={bmiStyles.scaleLabels}>
        {[18.5, 23, 25].map((v) => (
          <Text
            key={v}
            style={[bmiStyles.scaleLabelText, { left: `${((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%` }]}
          >
            {v}
          </Text>
        ))}
      </View>

      <View style={bmiStyles.detailRow}>
        <Text style={bmiStyles.detailText}>Weight {weight} kg</Text>
        <Text style={bmiStyles.detailText}>Height {Number(heightCm)} cm</Text>
      </View>
    </View>
  );
}

const bmiStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 14, fontWeight: "600", color: "#C96A0A" },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 12, fontWeight: "700" },
  bmiValue: { fontSize: 40, fontWeight: "bold", color: "#333", marginTop: 6, marginBottom: 14 },

  scaleWrapper: { justifyContent: "center" },
  scaleBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" },
  pointer: {
    position: "absolute",
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#333",
  },
  scaleLabels: { height: 14, marginTop: 6 },
  scaleLabelText: { position: "absolute", fontSize: 10, color: "#8E8E93", marginLeft: -8 },

  detailRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  detailText: { fontSize: 13, color: "#8E8E93" },
  emptyText: { fontSize: 13, color: "#8E8E93", marginTop: 8 },
});

// ===== หน้าจอสถิติแคลอรี่ =====
export default function CalorieChartScreen() {
    const router = useRouter();
    const { user, personalData } = useAuth();

    const [loading, setLoading] = useState(true);
    const [weeklyCalories, setWeeklyCalories] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [weeklyLabels, setWeeklyLabels] = useState<string[]>(["-", "-", "-", "-", "-", "-", "-"]);
    const [avgCalories, setAvgCalories] = useState<number>(0);

    const fetchWeeklyCalories = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const caloriesData: number[] = [];
            const labelsData: string[] = [];
            const today = new Date();

            // วนลูปย้อนหลังจากวันนี้ถอยกลับไป 6 วัน (รวมเป็น 7 วัน)
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const dateStr = d.toISOString().split("T")[0];

                // 🛠️ ดึง serving เพิ่มจากตาราง recipes
                const { data } = await supabase
                    .from("daily_record")
                    .select(`
                      record_item (
                        recipe:recipes (
                          serving,
                          recipe_ingredients (
                            weight_g,
                            ingredients (
                              ingredient_nutrients (
                                amount,
                                nutrients (
                                  nutrient_name
                                )
                              )
                            )
                          )
                        )
                      )
                    `)
                    .eq("user_id", user.id)
                    .eq("record_date", dateStr)
                    .maybeSingle();

                let dayCal = 0;
                if (data && data.record_item) {
                    dayCal = data.record_item.reduce((sum: number, item: any) => {
                        // ดึง serving จาก item.recipe
                        const servingCount = item.recipe?.serving || 1;
                        const recipeCal = calculateRecipeCalories(
                          item.recipe?.recipe_ingredients || [],
                          servingCount
                        );
                        return sum + recipeCal;
                    }, 0);
                }

                caloriesData.push(Math.round(dayCal));

                // ตัดข้อความเอาแค่วันที่สั้นๆ มาโชว์ที่แกน X (เช่น "10")
                labelsData.push(dateStr.split("-")[2]);
            }

            setWeeklyCalories(caloriesData);
            setWeeklyLabels(labelsData);

            // หาค่าเฉลี่ยแคลอรีที่บริโภคต่อวัน
            const total = caloriesData.reduce((sum, val) => sum + val, 0);
            setAvgCalories(Math.round(total / 7));

        } catch (error) {
            console.error("Error fetching weekly calories:", error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchWeeklyCalories();
        }, [user])
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#C96A0A" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* ส่วนหัวหน้าจอ */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Statistic of Calories</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* กล่องสรุปภาพรวมในสัปดาห์ */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Average per week</Text>

                    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                        <Text style={styles.summaryValue}>{avgCalories}</Text>
                        <Text style={[styles.summaryUnit, { marginLeft: 6 }]}>kcal/day</Text>
                    </View>
                </View>

                {/* บล็อกแสดงกราฟเส้นพาสเทลแบบโค้งมน */}
                <View style={styles.chartWrapper}>
                    <Text style={styles.chartTitle}>Trend of Calorie Intake Over the Last 7 Days</Text>
                    <LineChart
                        data={{
                            labels: weeklyLabels,
                            datasets: [{ data: weeklyCalories }]
                        }}
                        width={Dimensions.get("window").width - 40}
                        height={220}
                        yAxisSuffix=" kcal"
                        chartConfig={{
                            backgroundColor: "#FFFFFF",
                            backgroundGradientFrom: "#FFFFFF",
                            backgroundGradientTo: "#FFFFFF",
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(242, 142, 43, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(142, 142, 147, ${opacity})`,
                            style: { borderRadius: 16 },
                            propsForDots: { r: "5", strokeWidth: "2", stroke: "#C96A0A" },
                            propsForBackgroundLines: { strokeDasharray: "5", stroke: "#E5E5EA" }
                        }}
                        bezier
                        style={styles.lineChartStyle}
                    />
                </View>

                {/* [BMI] การ์ด BMI: ชื่อ column weight/height ต้องตรงกับตาราง personalData ของคุณ */}
                <View style={{ marginTop: 20 }}>
                    <BmiCard weightKg={personalData?.weight} heightCm={personalData?.height} />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: "#F8F9FA" },
    centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: "#FFFFFF" },
    backButton: { width: 40, height: 40, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
    scrollContent: { padding: 20, paddingBottom: 40 },

    summaryCard: { backgroundColor: "#F28E2B", borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: "#C96A0A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500", marginBottom: 5 },
    summaryValue: { color: "#FFFFFF", fontSize: 28, fontWeight: "bold" },
    summaryUnit: { fontSize: 16, fontWeight: "normal", color: "#FFFFFF" },

    chartWrapper: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 15, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    chartTitle: { fontSize: 14, fontWeight: "600", color: "#666", alignSelf: "flex-start", marginBottom: 15, paddingLeft: 5 },
    lineChartStyle: { marginVertical: 5, borderRadius: 16 }
});