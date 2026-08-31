import { useState, useEffect } from "react";
import { StyleSheet, Text, View, Image, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [username, setUsername] = useState<string>("");

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  // 1. ดึงข้อมูล username จากตาราง profiles
  const fetchProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("profile_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setUsername(data.username || "User");
        setNewUsername(data.username || "User");
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error.message);
      Alert.alert("Error", "Failed to fetch profile data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // 2. ฟังก์ชันอัปเดต username กลับไปที่ Supabase
  const handleUpdateUsername = async () => {
    if (!user) return;
    if (!newUsername.trim()) {
      Alert.alert("Warning", "Please enter a username");
      return;
    }

    try {
      setUpdating(true);
      const { error } = await supabase
        .from("profiles")
        .update({ username: newUsername, updated_at: new Date() })
        .eq("profile_id", user.id);

      if (error) throw error;

      setUsername(newUsername);
      setIsEditModalVisible(false);
      Alert.alert("Success", "Username updated successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      Alert.alert("Error", "Failed to update username");
    } finally {
      setUpdating(false);
    }
  };
  // 3. ฟังก์ชันสำหรับออกจากระบบและเด้งไปหน้า Login
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
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF9500" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* <Text style={styles.screenTitle}>Profile</Text> */}

      {/* กล่องส้มด้านบน */}
      <View style={styles.orangeCard}>
        <View style={styles.profileInfoContainer}>
          {/* รูป Avatar (ตอนนี้ใช้ placeholder แบบน่ารักๆ ไปก่อนชั่วคราว) */}
          <Image
            source={{ uri: "https://api.dicebear.com/7.x/bottts/svg?seed=Felix" }}
            style={styles.avatar}
          />
          <View style={styles.textContainer}>
            <Text style={styles.displayNameText}>{username}</Text>
            <Text style={styles.usernameText}>@{username.toLowerCase().replace(/\s+/g, "")}</Text>
          </View>
        </View>

        {/* ปุ่มดินสอสำหรับกดแก้ไข */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            setNewUsername(username);
            setIsEditModalVisible(true);
          }}
        >
          <Ionicons name="pencil-sharp" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ส่วนเมนูอื่นๆ */}
      <View style={styles.menuContainer}>
        {/* My Account */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/profile/account")} 
        >
          <Ionicons name="person-outline" size={22} color="#5856D6" />
          <Text style={styles.menuText}>My Account</Text>
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </TouchableOpacity>

        {/* Personal Data */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/profile/personalData")} 
        >
          <Ionicons name="person-outline" size={22} color="#5856D6" />
          <Text style={styles.menuText}>Personal Data</Text>
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </TouchableOpacity>
        
        {/* Logout */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setIsLogoutModalVisible(true)}
        >
          <Ionicons name="log-out-outline" size={22} color="#FF3B30" /> 
          <Text style={[styles.menuText, { color: "#FF3B30" }]}>Logout</Text> 
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </TouchableOpacity>

      </View>

      {/* Pop-up Modal สำหรับกรอกแก้ไข Username */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Username</Text>

            <TextInput
              style={styles.input}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter new username"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />

            <View style={styles.modalButtonContainer}>
              {/* ปุ่มยกเลิก */}
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsEditModalVisible(false)}
                disabled={updating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {/* ปุ่มบันทึก */}
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleUpdateUsername}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pop-up Modal สำหรับยืนยันการ Logout */}
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
  mainContainer: { flex: 1, backgroundColor: "#F8F9FA", paddingHorizontal: 20, paddingTop: 60 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" },
  screenTitle: { fontSize: 28, fontWeight: "bold", color: "#1C1C1E", marginBottom: 20 },

  // สไตล์กล่องส้ม
  orangeCard: {
    backgroundColor: "#F28E2B", // สีส้มโทนละมุนตามแบบ
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#F28E2B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  profileInfoContainer: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 65, height: 65, borderRadius: 32.5, backgroundColor: "#FFF", borderWidth: 2, borderColor: "#FFF" },
  textContainer: { marginLeft: 15, flex: 1 },
  displayNameText: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF" },
  usernameText: { fontSize: 14, color: "rgba(255, 255, 255, 0.75)", marginTop: 2 },
  editButton: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },

  // สไตล์เมนูด้านล่าง
  menuContainer: { marginTop: 25 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", padding: 16, borderRadius: 12, marginBottom: 12 },
  menuText: { flex: 1, marginLeft: 15, fontSize: 16, fontWeight: "500", color: "#3A3A3C" },

  // สไตล์ Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#FFF", width: "80%", borderRadius: 16, padding: 20, alignItems: "center" },
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