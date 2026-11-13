// Shared "email -> OTP -> new password" flow.
// - Logged in (Change Password): pass lockedEmail, the email box is shown disabled and pre-filled.
// - Logged out (Forgot Password): no lockedEmail, the user types their own email.
//
// The whole flow runs on a temporary Supabase client (no stored session). verifyOtp signs the user in, and on the
// main client that SIGNED_IN event would make NavigationGate send them to the home screen before they pick a
// new password. The temp client never touches the main session.

import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/src/config/supabase";
import PasswordInput from "@/components/PasswordInput";
import {
  EMAIL_MAX,
  PASSWORD_MAX,
  PASSWORD_SPECIALS,
  normalizeEmail,
  validateEmail,
  validateNewPassword,
} from "@/src/utils/authValidation";

type Step = "SEND_OTP" | "VERIFY_OTP" | "NEW_PASSWORD";

type Props = {
  // set = logged-in user: email is fixed and cannot be edited
  lockedEmail?: string;
  // called after the password was changed (the caller decides where to go / whether to sign out)
  onDone: () => void | Promise<void>;
};

const makeTempClient = () => {
  const url =
    ((supabase as any).supabaseUrl as string) ||
    (process.env.EXPO_PUBLIC_SUPABASE_URL as string);
  const key =
    ((supabase as any).supabaseKey as string) ||
    (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string);
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "password-reset-flow", // separate from the main client
    },
  });
};

export default function PasswordResetFlow({ lockedEmail, onDone }: Props) {
  const locked = lockedEmail !== undefined;
  const [step, setStep] = useState<Step>("SEND_OTP");
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState(lockedEmail ?? "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const clientRef = useRef<ReturnType<typeof makeTempClient> | null>(null);
  const client = () => (clientRef.current ??= makeTempClient());

  const email = locked ? (lockedEmail as string) : normalizeEmail(emailInput);

  const handleSendOTP = async () => {
    if (loading) return;
    const emailError =
      locked && !email ? "No email on this account." : validateEmail(email);
    if (emailError) {
      Alert.alert("Warning", emailError);
      return;
    }
    try {
      setLoading(true);
      const { error } = await client().auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert(
        "Check your email",
        "If this email is registered, a verification code has been sent.",
      );
      setOtp("");
      setStep("VERIFY_OTP");
    } catch (error: any) {
      console.error("Error sending OTP:", error.message);
      Alert.alert("Error", "Failed to send the code: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (loading) return;
    const code = otp.trim();
    if (!/^\d{6,8}$/.test(code)) {
      Alert.alert("Warning", "Please enter the code from your email");
      return;
    }
    try {
      setLoading(true);
      const { error } = await client().auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      });
      if (error) throw error;
      setStep("NEW_PASSWORD");
    } catch (error: any) {
      console.error("Error verifying OTP:", error.message);
      Alert.alert("Error", "OTP code is invalid or has expired");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async () => {
    if (loading) return;
    const passError = validateNewPassword(newPassword, confirmPassword);
    if (passError) {
      Alert.alert("Warning", passError);
      return;
    }
    try {
      setLoading(true);
      const { error } = await client().auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      try {
        await client().auth.signOut({ scope: "local" });
      } catch {}
      setNewPassword("");
      setConfirmPassword("");
      await onDone();
    } catch (error: any) {
      console.log("Error resetting password:", error.message);
      Alert.alert("Error", error?.message || "Failed to set new password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      {step === "SEND_OTP" && (
        <>
          <Text style={styles.inputLabel}>Email</Text>
          {locked ? (
            <View style={styles.disabledInput}>
              <Text style={styles.disabledInputText}>{email}</Text>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={emailInput}
              onChangeText={setEmailInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              maxLength={EMAIL_MAX}
              editable={!loading}
            />
          )}

          {locked ? (
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>Want to change password? </Text>
              <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                <Text style={styles.linkText}>Send OTP</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.7 }]}
              onPress={handleSendOTP}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>Send OTP</Text>
            </TouchableOpacity>
          )}

          {loading && (
            <ActivityIndicator
              size="small"
              color="#F28E2B"
              style={{ marginTop: 20 }}
            />
          )}
        </>
      )}

      {step === "VERIFY_OTP" && (
        <>
          <Text style={styles.sectionTitle}>Verify your email</Text>
          <Text style={styles.sectionSubTitle}>
            Please enter the OTP sent to {email}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter OTP..."
            placeholderTextColor="#999"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={8}
            autoFocus
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={() => setStep("SEND_OTP")}
            disabled={loading}
          >
            <Text style={styles.textButtonText}>Back</Text>
          </TouchableOpacity>
        </>
      )}

      {step === "NEW_PASSWORD" && (
        <>
          <Text style={styles.sectionTitle}>Set New Password</Text>
          <Text style={styles.sectionSubTitle}>
            8-24 characters with an uppercase letter, a lowercase letter, a
            number and a special character ({PASSWORD_SPECIALS}). Other
            characters and spaces are not allowed.
          </Text>

          <Text style={styles.inputLabel}>New Password</Text>
          <PasswordInput
            placeholder="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
          />

          <Text style={styles.inputLabel}>Confirm New Password</Text>
          <PasswordInput
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSavePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save New Password</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: { width: "100%", marginTop: 10 },
  inputLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 8,
    marginTop: 10,
  },
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
  linkText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 8,
  },
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
  textButton: {
    width: "100%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  textButtonText: { color: "#8E8E93", fontSize: 16, fontWeight: "500" },
});
