import { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

export default function MyAccountScreen() {
    const router = useRouter();
    const { user } = useAuth(); // ใช้ดึงข้อมูลจาก auth.users ได้ตรงๆ

    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string>("");

    // ดึงข้อมูล Email จาก Auth User และ ดึง Role จากตาราง Profiles
    const fetchAccountData = async () => {
        if (!user) return;
        try {
            setLoading(true);

            // ดึงข้อมูล role จากตาราง profiles
            const { data, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("profile_id", user.id)
                .single();

            if (error) throw error;

            if (data) {
                setRole(data.role || "User");
            }
        } catch (error: any) {
            console.error("Error fetching account details:", error.message);
            Alert.alert("Error", "ไม่สามารถโหลดข้อมูลบัญชีได้");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccountData();
    }, [user]);

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#FF9500" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>

            {/* ⬅️ แถบ Header และปุ่มย้อนกลับ */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#FF7A00" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Account</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

                {/* ℹ️ ส่วนแสดงข้อมูล Account */}
                <Text style={styles.sectionTitle}>Account Information</Text>

                <View style={styles.infoBox}>
                    {/* ส่วนแสดง Email จาก Auth ของ Supabase */}
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>{user?.email || "No Email Found"}</Text>
                    </View>
                </View>

                {/* ส่วนตั้งค่าความปลอดภัย */}
                <Text style={styles.sectionTitle}>Security Settings</Text>

                {/* ปุ่มเปลี่ยนรหัสผ่าน */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push("/profile/changePassword")} // 👈 ชี้ทางมาที่ไฟล์ใหม่
                >
                    <View style={styles.actionIconContainer}>
                        <Ionicons name="key-outline" size={20} color="#F28E2B" />
                    </View>
                    <Text style={styles.actionText}>Change Password</Text>
                    <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                </TouchableOpacity>

                {/* ปุ่มลบบัญชี */}
                <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => router.push("/profile/deleteAccount")}>
                    <View style={[styles.actionIconContainer, styles.deleteIconContainer]}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </View>
                    <Text style={[styles.actionText, styles.deleteText]}>Delete Account</Text>
                    <Ionicons name="chevron-forward" size={18} color="#FFD2D2" />
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: "#F8F9FA" },
    centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" },

    // สไตล์ Header ด้านบนสุด
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E5EA",
    },
    backButton: { width: 40, height: 40, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "bold", color: "#FF7A00" },

    contentContainer: { padding: 20 },
    sectionTitle: { fontSize: 14, fontWeight: "600", color: "#8E8E93", textTransform: "uppercase", marginBottom: 10, marginTop: 15, paddingLeft: 5 },

    // สไตล์กล่องข้อมูล Email
    infoBox: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
    },
    infoLabel: { fontSize: 16, color: "#3A3A3C", fontWeight: "500" },
    infoValue: { fontSize: 15, color: "#8E8E93" },
    roleBadge: {
        color: "#F28E2B",
        fontWeight: "bold",
        backgroundColor: "rgba(242, 142, 43, 0.1)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        overflow: "hidden",
    },
    // สไตล์ปุ่ม Action ต่างๆ (รหัสผ่าน และ ลบบัญชี)
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        padding: 14,
        borderRadius: 14,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    actionIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "rgba(242, 142, 43, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    actionText: { flex: 1, fontSize: 16, fontWeight: "500", color: "#1C1C1E" },

    // สไตล์เฉพาะปุ่มลบ
    deleteButton: { borderColor: "rgba(255, 59, 48, 0.15)", borderWidth: 1 },
    deleteIconContainer: { backgroundColor: "rgba(255, 59, 48, 0.1)" },
    deleteText: { color: "#FF3B30", fontWeight: "600" },
});