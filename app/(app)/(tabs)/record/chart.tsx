import { useState, useCallback } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

export default function CalorieChartScreen() {
    const router = useRouter();
    const { user } = useAuth();

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

                const { data } = await supabase
                    .from("daily_record")
                    .select(`
            record_item (
              recipe (
                recipe_nutrient!fk_nutrient_to_recipe (calories)
              )
            )
          `)
                    .eq("user_id", user.id)
                    .eq("record_date", dateStr)
                    .maybeSingle();

                let dayCal = 0;
                if (data && data.record_item) {
                    dayCal = data.record_item.reduce((sum: number, item: any) => {
                        const cal = item.recipe?.recipe_nutrient?.[0]?.calories || item.recipe?.recipe_nutrient?.calories || 0;
                        return sum + Number(cal);
                    }, 0);
                }

                caloriesData.push(dayCal);

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
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* ส่วนหัวหน้าจอ */}
            <View style={styles.header}>
                {/*<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>*/}
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
                            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(142, 142, 147, ${opacity})`,
                            style: { borderRadius: 16 },
                            propsForDots: { r: "5", strokeWidth: "2", stroke: "#007AFF" },
                            propsForBackgroundLines: { strokeDasharray: "5", stroke: "#E5E5EA" }
                        }}
                        bezier
                        style={styles.lineChartStyle}
                    />
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
    scrollContent: { padding: 20 },

    summaryCard: { backgroundColor: "#007AFF", borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: "#007AFF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500", marginBottom: 5 },
    summaryValue: { color: "#FFFFFF", fontSize: 28, fontWeight: "bold" },
    summaryUnit: { fontSize: 16, fontWeight: "normal", color: "#FFFFFF" },

    chartWrapper: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 15, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    chartTitle: { fontSize: 14, fontWeight: "600", color: "#666", alignSelf: "flex-start", marginBottom: 15, paddingLeft: 5 },
    lineChartStyle: { marginVertical: 5, borderRadius: 16 }
});