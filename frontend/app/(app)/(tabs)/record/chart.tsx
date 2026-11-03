import { useState, useCallback } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

// อ่านแคลอรี่ต่อ 1 serving จากตาราง recipe_features (คำนวณไว้ในฐานข้อมูลแล้ว)
const getCalories = (features: any): number => {
  // recipe_id เป็น PK+FK จึงได้เป็น object เดียว แต่กันกรณีที่ได้ array ไว้ด้วย
  const f = Array.isArray(features) ? features[0] : features;
  return Number(f?.calories) || 0; // numeric จาก Postgres อาจมาเป็น string
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

// ===== หน้าจอสถิติแคลอรี่ (รายเดือน) =====
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// สร้างสตริงวันที่ "YYYY-MM-DD" ตามเวลาท้องถิ่น (ไม่ใช้ toISOString เพราะช่วงหลังเที่ยงคืนในเวลาไทยจะเพี้ยนไปเป็นวันก่อนหน้า)
const toDateStr = (year: number, monthIndex: number, day: number) =>
    `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export default function CalorieChartScreen() {
    const router = useRouter();
    const { user, personalData } = useAuth();

    const now = new Date();

    // เดือนที่กำลังดูอยู่ (เก็บเป็นวันที่ 1 ของเดือน) เริ่มต้นที่เดือนปัจจุบัน
    const [viewMonth, setViewMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
    const isCurrentMonth =
        viewMonth.getFullYear() === now.getFullYear() && viewMonth.getMonth() === now.getMonth();

    const [loading, setLoading] = useState(true);
    const [dailyCalories, setDailyCalories] = useState<number[]>([]);
    const [dayLabels, setDayLabels] = useState<string[]>([]);
    const [avgCalories, setAvgCalories] = useState<number>(0);
    const [loggedDays, setLoggedDays] = useState<number>(0);

    const fetchMonthlyCalories = async () => {
        if (!user) return;
        try {
            setLoading(true);

            const year = viewMonth.getFullYear();
            const month = viewMonth.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // เดือนปัจจุบันแสดงถึงวันนี้เท่านั้น (ไม่แสดงวันในอนาคต) เดือนที่ผ่านมาแล้วแสดงครบทุกวัน
            const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;

            // ดึงทั้งเดือนในคำขอเดียว: record_item -> recipes -> recipe_features
            const { data, error } = await supabase
                .from("record_item")
                .select(`
                  record_date,
                  recipe:recipes (
                    recipe_features (
                      calories
                    )
                  )
                `)
                .eq("user_id", user.id)
                .gte("record_date", toDateStr(year, month, 1))
                .lte("record_date", toDateStr(year, month, lastDay));

            if (error) throw error;

            // รวมแคลอรี่ของแต่ละวัน (index 0 = วันที่ 1)
            const perDay: number[] = new Array(lastDay).fill(0);
            (data || []).forEach((item: any) => {
                const day = Number(String(item.record_date).slice(8, 10));
                if (day >= 1 && day <= lastDay) {
                    perDay[day - 1] += getCalories(item.recipe?.recipe_features);
                }
            });

            const rounded = perDay.map((v) => Math.round(v));

            // แกน X แสดงวันที่ 1, 5, 10, 15, ... เพื่อไม่ให้ตัวเลขแน่นเกินไป
            const labels = rounded.map((_, i) => {
                const day = i + 1;
                return day === 1 || day % 5 === 0 ? String(day) : "";
            });

            setDailyCalories(rounded);
            setDayLabels(labels);

            // ค่าเฉลี่ยต่อวัน คิดเฉพาะวันที่มีการบันทึกอาหาร (ไม่ให้วันที่ไม่ได้บันทึกดึงค่าเฉลี่ยลง)
            const logged = rounded.filter((v) => v > 0);
            setLoggedDays(logged.length);
            setAvgCalories(logged.length > 0 ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0);

        } catch (error) {
            console.error("Error fetching monthly calories:", error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchMonthlyCalories();
        }, [user, viewMonth])
    );

    const goPrevMonth = () =>
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    const goNextMonth = () => {
        if (isCurrentMonth) return;
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    };

    const monthTitle = `${MONTH_NAMES[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

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

                {/* กล่องสรุปภาพรวมของเดือนที่เลือก */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Daily average · {monthTitle}</Text>

                    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                        <Text style={styles.summaryValue}>{avgCalories}</Text>
                        <Text style={[styles.summaryUnit, { marginLeft: 6 }]}>kcal/day</Text>
                    </View>
                    <Text style={styles.summarySub}>from {loggedDays} logged {loggedDays === 1 ? "day" : "days"}</Text>
                </View>

                {/* บล็อกแสดงกราฟเส้นแคลอรี่รายวันของทั้งเดือน */}
                <View style={styles.chartWrapper}>
                    <View style={styles.monthRow}>
                        <TouchableOpacity style={styles.monthBtn} onPress={goPrevMonth}>
                            <Ionicons name="chevron-back" size={20} color="#F28E2B" />
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>{monthTitle}</Text>
                        <TouchableOpacity
                            style={[styles.monthBtn, isCurrentMonth && { opacity: 0.3 }]}
                            onPress={goNextMonth}
                            disabled={isCurrentMonth}
                        >
                            <Ionicons name="chevron-forward" size={20} color="#F28E2B" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.chartTitle}>Calorie Intake by Day</Text>

                    {loading || dailyCalories.length === 0 ? (
                        <View style={styles.chartLoading}>
                            <ActivityIndicator size="large" color="#C96A0A" />
                        </View>
                    ) : (
                        <LineChart
                            data={{
                                labels: dayLabels,
                                datasets: [{ data: dailyCalories }]
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
                                propsForDots: { r: "3", strokeWidth: "2", stroke: "#C96A0A" },
                                propsForBackgroundLines: { strokeDasharray: "5", stroke: "#E5E5EA" }
                            }}
                            bezier
                            style={styles.lineChartStyle}
                        />
                    )}
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
    lineChartStyle: { marginVertical: 5, borderRadius: 16 },

    summarySub: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 4 },
    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 10 },
    monthBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFEBD6", justifyContent: "center", alignItems: "center" },
    monthTitle: { fontSize: 16, fontWeight: "700", color: "#C96A0A" },
    chartLoading: { height: 220, justifyContent: "center", alignItems: "center" }
});