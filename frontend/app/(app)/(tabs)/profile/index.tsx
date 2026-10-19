import { useState } from "react";
import { StyleSheet, Text, View, Image, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker"; 
import { decode } from "base64-arraybuffer"; 
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/bottts/png?seed=Felix";

// [ORANGE] พาเลตสีส้มของแอป (ใช้เฉพาะจุดเด่น ไม่ใช่ทั้งหน้า)
const ORANGE = "#F28E2B"; // สีหลัก
const ORANGE_DARK = "#C96A0A"; // ใช้กับป้ายกล้อง
const ORANGE_SOFT = "#FFEBD6"; // พื้นวงกลมไอคอนเมนู
const ORANGE_BORDER = "#F6C48F"; // เส้นขอบ/ลูกศรแบบอ่อน

export default function ProfileScreen() {
  const { user, profile, loading, refreshUserData } = useAuth();
  const router = useRouter();

  const [updating, setUpdating] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const username = profile?.username || "User";
  const displayName = profile?.display_name || "";

  const avatarUri = profile?.avatar_url || DEFAULT_AVATAR;

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  const handlePickAvatar = async () => {
    if (!user) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], 
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6, 
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Error", "Could not read the selected image");
      return;
    }

    try {
      setUploadingAvatar(true);

      const contentType = asset.mimeType || "image/jpeg";
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatar")
        .upload(filePath, decode(asset.base64), { contentType, upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatar").getPublicUrl(filePath);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("profile_id", user.id);

      if (updateError) throw updateError;

      await refreshUserData();
    } catch (error: any) {
      console.error("Error uploading avatar:", error.message);
      Alert.alert("Error", "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

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

      await refreshUserData();
      setIsEditModalVisible(false);
      Alert.alert("Success", "Username updated successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error.message);
      Alert.alert("Error", "Failed to update username");
    } finally {
      setUpdating(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setIsLogoutModalVisible(false);

      router.replace("/(auth)/login");
    } catch (error: any) {
      console.error("Error signing out:", error.message);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* <Text style={styles.screenTitle}>Profile</Text> */}

      {/* กล่องส้มด้านบน */}
      <View style={styles.orangeCard}>
        <View style={styles.profileInfoContainer}>
          {/* [AVATAR] รูป Avatar กดเพื่อเปลี่ยนรูปได้ */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            <Image source={{ uri: avatarUri }} style={styles.avatar} />

            {/* [AVATAR] overlay หมุนๆ ตอนกำลังอัปโหลด */}
            {uploadingAvatar && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#FFF" />
              </View>
            )}

            {/* [AVATAR] ไอคอนกล้องเล็กๆ มุมขวาล่าง บอกว่ากดเปลี่ยนรูปได้ */}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.textContainer}>
            <Text style={styles.displayNameText}>{username}</Text>
            {!!displayName && <Text style={styles.usernameText}>@{displayName}</Text>}
          </View>
        </View>

        {/* ปุ่มดินสอสำหรับกดแก้ไข */}
        <TouchableOpacity
          style={styles.editButton}
          activeOpacity={0.75}
          onPress={() => {
            setNewUsername(username);
            setIsEditModalVisible(true);
          }}
        >
          <Ionicons name="pencil-sharp" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ส่วนเมนูอื่นๆ */}
      <View style={styles.menuContainer}>
        {/* My Account */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => router.push("/profile/account")} 
        >
          <View style={styles.menuIconCircle}>
            <Ionicons name="person-outline" size={20} color={ORANGE} />
          </View>
          <Text style={styles.menuText}>My Account</Text>
          <Ionicons name="chevron-forward" size={18} color={ORANGE_BORDER} />
        </TouchableOpacity>

        {/* Personal Data */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => router.push("/profile/personalData")} 
        >
          <View style={styles.menuIconCircle}>
            <Ionicons name="person-outline" size={20} color={ORANGE} />
          </View>
          <Text style={styles.menuText}>Personal Data</Text>
          <Ionicons name="chevron-forward" size={18} color={ORANGE_BORDER} />
        </TouchableOpacity>
        
        {/* Logout */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => setIsLogoutModalVisible(true)}
        >
          <View style={[styles.menuIconCircle, styles.menuIconCircleDanger]}>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          </View>
          <Text style={[styles.menuText, { color: "#FF3B30" }]}>Logout</Text> 
          <Ionicons name="chevron-forward" size={18} color={ORANGE_BORDER} />
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
                activeOpacity={0.75}
                onPress={() => setIsEditModalVisible(false)}
                disabled={updating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {/* ปุ่มบันทึก */}
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                activeOpacity={0.85}
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
                activeOpacity={0.75}
                onPress={() => setIsLogoutModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {/* ปุ่มยืนยันออกจากระบบ */}
              <TouchableOpacity
                style={[styles.modalButton, styles.logoutConfirmButton]}
                activeOpacity={0.85}
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
    backgroundColor: ORANGE, // สีส้มโทนละมุนตามแบบ
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  profileInfoContainer: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#FFF", borderWidth: 2.5, borderColor: "#FFF" },

  // [AVATAR] สไตล์ overlay ตอนอัปโหลด และไอคอนกล้อง
  avatarLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ORANGE_DARK,
    borderWidth: 2,
    borderColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },

  textContainer: { marginLeft: 15, flex: 1 },
  displayNameText: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF" },
  usernameText: { fontSize: 14, color: "rgba(255, 255, 255, 0.75)", marginTop: 2 },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },

  // สไตล์เมนูด้านล่าง
  menuContainer: { marginTop: 25 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ORANGE_SOFT,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIconCircleDanger: { backgroundColor: "#FFEBEA" },
  menuText: { flex: 1, marginLeft: 14, fontSize: 16, fontWeight: "500", color: "#3A3A3C" },

  // สไตล์ Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: {
    backgroundColor: "#FFF",
    width: "82%",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 15 },
  input: { width: "100%", height: 48, borderWidth: 1.5, borderColor: ORANGE_BORDER, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, color: "#333", marginBottom: 20, backgroundColor: "#F8F9FA" },
  modalButtonContainer: { flexDirection: "row", width: "100%", justifyContent: "space-between" },
  modalButton: { flex: 1, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  cancelButton: { backgroundColor: "#F2F2F7", marginRight: 10 },
  cancelButtonText: { color: "#8E8E93", fontSize: 16, fontWeight: "600" },
  saveButton: {
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
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
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
