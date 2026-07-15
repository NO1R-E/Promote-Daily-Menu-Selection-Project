import { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

type Step = "SEND_OTP" | "VERIFY_OTP" | "NEW_PASSWORD";

export default function ChangePasswordScreen() {
    const router = useRouter();
    const { user } = useAuth(); // ดึง Email จากผู้ใช้ปัจจุบันมาแสดงอัตโนมัติ

    const [step, setStep] = useState<Step>("SEND_OTP");
    const [loading, setLoading] = useState(false);

    // State สำหรับเก็บข้อมูลแต่ละขั้นตอน
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const email = user?.email || "";

    // 1. ส่ง OTP ไปที่ Email ของผู้ใช้
    const handleSendOTP = async () => {
        if (!email) return;
        try {
            setLoading(true);

            // ✅ ใช้คำสั่งนี้ของ Supabase เพื่อส่งเมล Reset Password ไปหา User
            const { error } = await supabase.auth.resetPasswordForEmail(email);

            if (error) throw error;

            Alert.alert("Success", "OTP code sent to your email for password recovery");
            setStep("VERIFY_OTP"); // ย้ายไปสเต็ปกรอก OTP
        } catch (error: any) {
            console.error("Error sending OTP:", error.message);
            Alert.alert("Error", "Failed to send OTP to your email: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 2. ตรวจสอบรหัส OTP ที่ผู้ใช้กรอก
    const handleVerifyOTP = async () => {
        if (!otp.trim()) {
            Alert.alert("Warning", "Please enter the OTP code");
            return;
        }

        try {
            setLoading(true);

            // ✅ ยืนยันรหัส OTP ด้วย Type "recovery"
            const { error } = await supabase.auth.verifyOtp({
                email: email,
                token: otp,
                type: "recovery",
            });

            if (error) throw error;

            // ถ้าผ่านด่านเรียบร้อย ให้สลับไปหน้าตั้งรหัสผ่านใหม่
            setStep("NEW_PASSWORD");
        } catch (error: any) {
            console.error("Error verifying OTP:", error.message);
            Alert.alert("Error", "OTP code is invalid or has expired");
        } finally {
            setLoading(false);
        }
    };

    // 3. บันทึกรหัสผ่านใหม่ลงระบบ และพาเตะกลับหน้า Login
    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert("Warning", "Please fill password in all fields");
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert("Warning", "Password must be at least 6 characters long");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Warning", "Passwords do not match");
            return;
        }

        try {
            setLoading(true);
            // อัปเดตรหัสผ่านใหม่ให้กับ User ปัจจุบัน
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            // ออกจากระบบเพื่อความปลอดภัย
            await supabase.auth.signOut();

            Alert.alert("Success", "Password changed successfully. Please log in again.", [
                {
                    text: "OK",
                    onPress: () => {
                        // เตะกลับไปหน้า Login และรีเซ็ตสแต็ก
                        router.replace("/(auth)/login");
                    }
                }
            ]);
        } catch (error: any) {
            console.error("Error resetting password:", error.message);
            Alert.alert("Error", "Failed to set new password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.mainContainer}
        >
            {/* ⬅️ Header */}
            <View style={styles.header}>
                {/*<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#F28E2B" />
                </TouchableOpacity>*/}
                <Text style={styles.headerTitle}>Change Password</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* ----------------- STEP 1: แสดง Email & กดส่ง OTP ----------------- */}
                {step === "SEND_OTP" && (
                    <View style={styles.formContainer}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <View style={styles.disabledInput}>
                            <Text style={styles.disabledInputText}>{email}</Text>
                        </View>

                        <View style={styles.hintContainer}>
                            <Text style={styles.hintText}>Want to change password? </Text>
                            <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                                <Text style={styles.linkText}>Send OTP</Text>
                            </TouchableOpacity>
                        </View>

                        {loading && <ActivityIndicator size="small" color="#F28E2B" style={{ marginTop: 20 }} />}
                    </View>
                )}

                {/* ----------------- STEP 2: กรอกรหัส OTP ----------------- */}
                {step === "VERIFY_OTP" && (
                    <View style={styles.formContainer}>
                        <Text style={styles.sectionTitle}>Verify your email</Text>
                        <Text style={styles.sectionSubTitle}>please enter the OTP sent to {email}</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Enter OTP..."
                            placeholderTextColor="#999"
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                            autoFocus
                        />

                        <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOTP} disabled={loading}>
                            {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.primaryButtonText}>Confirm OTP</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.textButton} onPress={() => setStep("SEND_OTP")} disabled={loading}>
                            <Text style={styles.textButtonText}>Back</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ----------------- STEP 3: ตั้งรหัสผ่านใหม่ ----------------- */}
                {step === "NEW_PASSWORD" && (
                    <View style={styles.formContainer}>
                        <Text style={styles.sectionTitle}>Set New Password</Text>
                        <Text style={styles.sectionSubTitle}>please set a new password for your account</Text>

                        <Text style={styles.inputLabel}>New Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="New Password (at least 6 characters)..."
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />

                        <Text style={styles.inputLabel}>Confirm New Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm New Password..."
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />

                        <TouchableOpacity style={styles.primaryButton} onPress={handleResetPassword} disabled={loading}>
                            {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.primaryButtonText}>Save New Password</Text>}
                        </TouchableOpacity>
                    </View>
                )}
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

    // สไตล์ Label และ Input สีเทาอ่านอย่างเดียว (ตามภาพ Mockup)
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
    },
    disabledInputText: { fontSize: 16, color: "#8E8E93" },

    // สไตล์ข้อความกดส่ง OTP (ตามภาพ Mockup)
    hintContainer: { flexDirection: "row", marginTop: 15, alignItems: "center" },
    hintText: { fontSize: 14, color: "#8E8E93" },
    linkText: { fontSize: 14, color: "#007AFF", fontWeight: "600", textDecorationLine: "underline" },

    // สไตล์หน้าตั้งรหัส / กรอก OTP
    sectionTitle: { fontSize: 22, fontWeight: "bold", color: "#1C1C1E", marginBottom: 8 },
    sectionSubTitle: { fontSize: 14, color: "#8E8E93", marginBottom: 25 },
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
    primaryButton: {
        width: "100%",
        height: 50,
        backgroundColor: "#F28E2B",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
    },
    primaryButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
    textButton: { width: "100%", height: 50, justifyContent: "center", alignItems: "center", marginTop: 10 },
    textButtonText: { color: "#8E8E93", fontSize: 16, fontWeight: "500" },
});