import { useState, useEffect } from "react";
import { StyleSheet, Text, View, Image, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

export default function tempScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // ปิด Modal ก่อน
      setIsLogoutModalVisible(false);

      // ส่งผู้ใช้กลับไปหน้า Login และเคลียร์ Stack หน้าจอไม่ให้กด Back กลับมาได้อีก
      router.replace("/(auth)/login");
    } catch (error: any) {
      console.error("Error signing out:", error.message);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Admin Panel</Text>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => (router.push("/(admin)/addIngredient"))}
      >
        <Ionicons name="add-outline" size={22} />
        <Text style={[styles.menuText]}>Add Ingredient</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => (router.push("/(admin)/checkForum"))}
      >
        <Ionicons name="checkmark-outline" size={22} />
        <Text style={[styles.menuText]}>Check Forum</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => (router.push("/(admin)/banAccount"))}
      >
        <Ionicons name="ban" size={22} />
        <Text style={[styles.menuText]}>Ban Account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => setIsLogoutModalVisible(true)}
      >
        <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
        <Text style={[styles.menuText, { color: "#FF3B30" }]}>Logout</Text>
      </TouchableOpacity>
      
      <Modal
              visible={isLogoutModalVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setIsLogoutModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  {/* วงกลมไอคอนเตือนสีแดง */}
                  <View style={styles.logoutIconCircle}>
                    <Ionicons name="log-out" size={32} color="#FF3B30" />
                  </View>
      
                  <Text style={styles.modalTitle}>Logout</Text>
                  <Text style={styles.modalSubTitle}>Are you sure you want to logout?</Text>
      
                  <View style={styles.modalButtonContainer}>
                    {/* ปุ่มยกเลิก */}
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setIsLogoutModalVisible(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
      
                    {/* ปุ่มยืนยันออกจากระบบ */}
                    <TouchableOpacity
                      style={[styles.modalButton, styles.logoutConfirmButton]}
                      onPress={handleLogout}
                    >
                      <Text style={styles.logoutButtonText}>Logout</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
    </View>
    

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 24, fontWeight: "500", color: "#F28E2B" },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", padding: 16, borderRadius: 12, marginBottom: 12, marginTop: 16 },
  menuText: { flex: 0.5, marginLeft: 15, fontSize: 16, fontWeight: "500", color: "#3A3A3C" },
  // modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#ffffff", width: "80%", borderRadius: 16, padding: 20, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 15 },
  input: { width: "100%", height: 48, borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 10, paddingHorizontal: 15, fontSize: 16, color: "#333", marginBottom: 20, backgroundColor: "#F2F2F7" },
  modalButtonContainer: { flexDirection: "row", width: "100%", justifyContent: "space-between" },
  modalButton: { flex: 1, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  cancelButton: { backgroundColor: "#F2F2F7", marginRight: 10 },
  cancelButtonText: { color: "#8E8E93", fontSize: 16, fontWeight: "600" },
  saveButton: { backgroundColor: "#F28E2B" },
  saveButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  // เพิ่มต่อท้ายสไตล์เดิมใน StyleSheet.create
  logoutIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  modalSubTitle: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 20,
  },
  logoutConfirmButton: {
    backgroundColor: "#FF3B30", // สีแดงเพื่อบ่งบอกว่าเป็น Action สำคัญ/อันตราย
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
