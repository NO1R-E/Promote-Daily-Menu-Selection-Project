import { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

const CONFIRM_WORD = "delete"; // พิมพ์ได้ทั้งตัวพิมพ์เล็ก/ใหญ่

// bucket ที่เก็บรูปของผู้ใช้ (ลบแบบ best-effort หลังลบบัญชีสำเร็จ)
const AVATAR_BUCKETS = ["avatar", "avatars"]; // รูปโปรไฟล์ เก็บที่ <userId>/...
const RECIPE_IMAGE_BUCKET = "recipe-images";

// ข้อความ error ที่ฟังก์ชัน delete_my_account ส่งมา -> ข้อความที่แสดงให้ผู้ใช้
const DELETE_ERRORS: Record<string, string> = {
    ADMIN_NOT_ALLOWED: "Admin accounts can not be deleted from the app.",
    NOT_AUTHENTICATED: "Please log in again and try once more.",
};

// ตรวจรหัสผ่านด้วย client ชั่วคราว (ไม่เก็บ session และไม่ส่งอีเวนต์เข้า AuthContext)
// ถ้าใช้ supabase client หลักเรียก signInWithPassword จะเกิดอีเวนต์ SIGNED_IN ทำให้แอปพาผู้ใช้กลับหน้า home
// คืน true = รหัสถูก, false = รหัสผิด, ส่วน error อื่น (เช่น เน็ตหลุด) จะ throw ออกไปให้ผู้เรียกจัดการ
const verifyPassword = async (email: string, password: string): Promise<boolean> => {
    const url = ((supabase as any).supabaseUrl as string) || (process.env.EXPO_PUBLIC_SUPABASE_URL as string);
    const key = ((supabase as any).supabaseKey as string) || (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string);

    const tempClient = createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: "delete-account-verify", // แยกจาก client หลัก
        },
    });

    const { error } = await tempClient.auth.signInWithPassword({ email, password });

    if (error) {
        if (/invalid login credentials/i.test(error.message)) return false;
        throw error;
    }

    // เก็บกวาด session ชั่วคราว (scope local = เฉพาะ session นี้ ไม่กระทบ session หลักของผู้ใช้)
    try {
        await tempClient.auth.signOut({ scope: "local" });
    } catch {
        // ไม่เป็นไร session ชั่วคราวหมดอายุเอง
    }
    return true;
};

export default function DeleteAccountScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    const email = user?.email || "";
    const canSubmit = password.length > 0 && confirmText.trim().toLowerCase() === CONFIRM_WORD;

    // ลบไฟล์รูปที่ค้างใน Storage หลังบัญชีถูกลบแล้ว (ถ้าลบไม่สำเร็จ ข้ามไปได้ ไม่กระทบการลบบัญชี)
    const removeStorageFiles = async (userId: string, imageUrls: string[]) => {
        try {
            // รูปโปรไฟล์: ลบทุกไฟล์ในโฟลเดอร์ของผู้ใช้
            for (const bucket of AVATAR_BUCKETS) {
                const { data: files } = await supabase.storage.from(bucket).list(userId);
                if (files && files.length > 0) {
                    await supabase.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
                }
            }

            // รูปของสูตรที่ถูกลบ (ฟังก์ชันส่ง URL มาให้) แปลงเป็น path ใน bucket
            const marker = `/${RECIPE_IMAGE_BUCKET}/`;
            const paths = imageUrls
                .map((url) => {
                    const i = url.indexOf(marker);
                    return i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split("?")[0]) : null;
                })
                .filter(Boolean) as string[];
            if (paths.length > 0) {
                await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove(paths);
            }
        } catch (error) {
            console.warn("Storage cleanup failed (ignored):", error);
        }
    };

    // กดลบ: 1) ตรวจรหัสผ่าน  2) เรียกฟังก์ชัน delete_my_account ในฐานข้อมูล (ลบข้อมูลและบัญชีในธุรกรรมเดียว)
    // แอปเรียก auth.admin.deleteUser() เองไม่ได้ เพราะต้องใช้สิทธิ์ผู้ดูแลระบบ จึงทำผ่านฟังก์ชันฝั่งเซิร์ฟเวอร์
    const handleDeleteAccount = async () => {
        if (!user || !email || !canSubmit) return;

        try {
            setLoading(true);

            const passwordOk = await verifyPassword(email, password);
            if (!passwordOk) {
                Alert.alert("Incorrect password", "The password you entered is incorrect. Nothing was deleted.");
                return;
            }

            const { data, error } = await supabase.rpc("delete_my_account");
            if (error) throw error;

            setPassword(""); // ไม่เก็บรหัสผ่านค้างใน state

            // บัญชีถูกลบแล้ว: เก็บกวาดไฟล์รูป (best-effort) แล้วล้าง session ในเครื่อง
            await removeStorageFiles(user.id, (data as any)?.images ?? []);
            await supabase.auth.signOut({ scope: "local" });

            Alert.alert("Account Deleted", "Your account and personal data have been permanently deleted.", [
                {
                    text: "OK",
                    onPress: () => router.replace("/(auth)/login"),
                },
            ]);
        } catch (error: any) {
            const text: string = error?.message || "";
            const code = Object.keys(DELETE_ERRORS).find((k) => text.includes(k));
            console.error("Error deleting account:", text);
            Alert.alert("Error", code ? DELETE_ERRORS[code] : "Failed to delete account. Nothing was deleted, please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.mainContainer}
        >
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={loading}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Delete Account</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.formContainer}>
                    <Text style={styles.sectionTitle}>Are you sure?</Text>

                    <View style={styles.warningBox}>
                        <Ionicons name="warning-outline" size={22} color="#FF3B30" style={{ marginRight: 10 }} />
                        <Text style={styles.warningText}>
                            This action cannot be undone. Your account and all of your personal data will be permanently deleted:
                            {"\n"}• profile, health and food preferences
                            {"\n"}• meal records and chat history
                            {"\n"}• your recipe posts and custom ingredients
                        </Text>
                    </View>

                    <Text style={styles.inputLabel}>Email</Text>
                    <View style={styles.disabledInput}>
                        <Text style={styles.disabledInputText}>{email}</Text>
                    </View>

                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Enter your password"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                        <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.inputLabel}>Type DELETE to confirm</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="DELETE"
                        placeholderTextColor="#999"
                        value={confirmText}
                        onChangeText={setConfirmText}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                    />

                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: "#FF3B30" }, (!canSubmit || loading) && styles.buttonDisabled]}
                        onPress={handleDeleteAccount}
                        disabled={!canSubmit || loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Permanently Delete My Account</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.textButton} onPress={() => router.back()} disabled={loading}>
                        <Text style={styles.textButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: "#FFFFFF" },
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
    headerTitle: { fontSize: 20, fontWeight: "bold" },
    scrollContainer: { padding: 24 },
    formContainer: { width: "100%", marginTop: 10 },
    inputLabel: { fontSize: 16, fontWeight: "bold", color: "#1C1C1E", marginBottom: 8, marginTop: 10 },
    disabledInput: {
        width: "100%",
        height: 50,
        borderWidth: 1,
        borderColor: "#E5E5EA",
        borderRadius: 8,
        paddingHorizontal: 15,
        justifyContent: "center",
        backgroundColor: "#FAFAFA",
        marginBottom: 10,
    },
    disabledInputText: { fontSize: 16, color: "#8E8E93" },
    sectionTitle: { fontSize: 22, fontWeight: "bold", color: "#1C1C1E", marginBottom: 12 },
    input: {
        width: "100%",
        height: 50,
        borderWidth: 1,
        borderColor: "#E5E5EA",
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 16,
        color: "#333",
        backgroundColor: "#FAFAFA",
        marginBottom: 20,
    },
    passwordRow: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height: 50,
        borderWidth: 1,
        borderColor: "#E5E5EA",
        borderRadius: 8,
        backgroundColor: "#FAFAFA",
        marginBottom: 10,
    },
    passwordInput: { flex: 1, height: "100%", paddingHorizontal: 15, fontSize: 16, color: "#333" },
    eyeButton: { paddingHorizontal: 14, height: "100%", justifyContent: "center" },
    warningBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#FFF1F0",
        borderWidth: 1,
        borderColor: "#FFD6D2",
        borderRadius: 10,
        padding: 14,
        marginBottom: 14,
    },
    warningText: { flex: 1, fontSize: 14, color: "#7A1F18", lineHeight: 22 },
    primaryButton: {
        width: "100%",
        height: 50,
        backgroundColor: "#F28E2B",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
    },
    buttonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
    textButton: { width: "100%", height: 50, justifyContent: "center", alignItems: "center", marginTop: 10 },
    textButtonText: { color: "#8E8E93", fontSize: 16, fontWeight: "500" },
});
