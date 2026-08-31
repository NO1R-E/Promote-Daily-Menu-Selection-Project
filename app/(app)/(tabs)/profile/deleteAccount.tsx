import { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

type Step = "SEND_OTP" | "VERIFY_OTP" | "CONFIRM_DELETE";

export default function DeleteAccountScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [step, setStep] = useState<Step>("SEND_OTP");
    const [loading, setLoading] = useState(false);
    const [otp, setOtp] = useState("");

    const email = user?.email || "";

    // 1. ส่ง OTP เพื่อยืนยันตัวตน
    const handleSendOTP = async () => {
        if (!email) return;
        try {
            setLoading(true);
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;

            Alert.alert("Success", "OTP code sent to your email");
            setStep("VERIFY_OTP");
        } catch (error: any) {
            Alert.alert("Error", "Failed to send OTP: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 2. ตรวจสอบรหัส OTP
    const handleVerifyOTP = async () => {
        if (!otp.trim()) {
            Alert.alert("Warning", "Please enter the OTP code");
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase.auth.verifyOtp({
                email: email,
                token: otp,
                type: "recovery",
            });

            if (error) throw error;

            // ยืนยัน OTP ผ่าน -> ไปสเต็ปยืนยันการลบบัญชี
            setStep("CONFIRM_DELETE");
        } catch (error: any) {
            Alert.alert("Error", "OTP code is invalid or has expired");
        } finally {
            setLoading(false);
        }
    };

    // 3. ฟังก์ชันดำเนินการลบบัญชีผู้ใช้
    const handleDeleteAccount = async () => {
        try {
            setLoading(true);

            // ⚠️ หมายเหตุ: Supabase client-side จะไม่มี deleteUser() โดยตรง 
            // หากต้องการลบ User ใน Supabase Auth แบบสมบูรณ์ ต้องเรียกผ่าน RPC / Edge Function
            // หรือถ้าออกแบบตารางใน DB ให้เคลียร์ข้อมูลผู้ใช้ คุณสามารถลบข้อมูลจากตารางได้ที่นี่
            
            /* ตัวอย่างการเรียก RPC หรือ Edge Function (ถ้ามี):
            const { error } = await supabase.rpc('delete_user_account');
            if (error) throw error;
            */

            // สั่ง Logout ผู้ใช้งานออกจากระบบ
            await supabase.auth.signOut();

            Alert.alert("Account Deleted", "Your account has been deleted successfully.", [
                {
                    text: "OK",
                    onPress: () => router.replace("/(auth)/login")
                }
            ]);
        } catch (error: any) {
            Alert.alert("Error", "Failed to delete account: " + error.message);
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
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Delete Account</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* STEP 1: ส่ง OTP */}
                {step === "SEND_OTP" && (
                    <View style={styles.formContainer}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <View style={styles.disabledInput}>
                            <Text style={styles.disabledInputText}>{email}</Text>
                        </View>

                        <View style={styles.hintContainer}>
                            <Text style={styles.hintText}>Want to delete your account? </Text>
                            <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                                <Text style={styles.linkText}>Send OTP</Text>
                            </TouchableOpacity>
                        </View>

                        {loading && <ActivityIndicator size="small" color="#F28E2B" style={{ marginTop: 20 }} />}
                    </View>
                )}

                {/* STEP 2: กรอก OTP */}
                {step === "VERIFY_OTP" && (
                    <View style={styles.formContainer}>
                        <Text style={styles.sectionTitle}>Verify your email</Text>
                        <Text style={styles.sectionSubTitle}>Please enter the OTP sent to {email}</Text>

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

                {/* STEP 3: ยืนยันการลบบัญชี (ปรับปรุงใหม่) */}
                {step === "CONFIRM_DELETE" && (
                    <View style={styles.formContainer}>
                        <Text style={styles.sectionTitle}>Are you sure?</Text>
                        <Text style={styles.sectionSubTitle}>
                            This action cannot be undone. All your personal data and records will be permanently removed.
                        </Text>

                        <TouchableOpacity 
                            style={[styles.primaryButton, { backgroundColor: "#FF3B30" }]} 
                            onPress={handleDeleteAccount} 
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Confirm Delete Account</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.textButton} onPress={() => router.back()} disabled={loading}>
                            <Text style={styles.textButtonText}>Cancel</Text>
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
    hintContainer: { flexDirection: "row", marginTop: 15, alignItems: "center" },
    hintText: { fontSize: 14, color: "#8E8E93" },
    linkText: { fontSize: 14, color: "#007AFF", fontWeight: "600", textDecorationLine: "underline" },
    sectionTitle: { fontSize: 22, fontWeight: "bold", color: "#1C1C1E", marginBottom: 8 },
    sectionSubTitle: { fontSize: 14, color: "#8E8E93", marginBottom: 25, lineHeight: 20 },
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