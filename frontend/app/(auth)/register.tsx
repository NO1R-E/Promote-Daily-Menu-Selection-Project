import { supabase } from "@/src/config/supabase";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import PasswordInput from "@/components/PasswordInput";
import {
  ORANGE,
  ORANGE_DARK,
  ORANGE_BORDER,
} from "@/components/forms/ingredientCommon";
import {
  EMAIL_MAX,
  PASSWORD_MAX,
  USERNAME_MAX,
  normalizeEmail,
  normalizeUsername,
  validateEmail,
  validateNewPassword,
  validateUsername,
} from "@/src/utils/authValidation";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // parameterised query (supabase-js), so the value can never change the SQL
  const checkUsernameExists = async (username: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();
    if (error) {
      console.log("Error checking username:", error.message);
      return false;
    }
    return data !== null;
  };

  // cheap checks first, the network call last
  const validateRegistrationInput = async () => {
    const userError = validateUsername(userName);
    if (userError) return userError;
    const emailError = validateEmail(email);
    if (emailError) return emailError;
    const passError = validateNewPassword(password, confirmPassword);
    if (passError) return passError;
    if (await checkUsernameExists(normalizeUsername(userName))) {
      return "Username already exists. Please choose another.";
    }
    return null;
  };

  const handleSignUp = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const validationError = await validateRegistrationInput();
      if (validationError) {
        Alert.alert("Validation Error", validationError);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: {
          data: {
            username: normalizeUsername(userName),
          },
        },
      });
      if (error) {
        Alert.alert("Signup Error", error.message);
      } else {
        Alert.alert("OTP Sent", "Check your email for the verification code.");
        setOtpSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (loading) return;
    const code = token.trim();
    if (!/^\d{6,8}$/.test(code)) {
      Alert.alert("Verification Failed", "Please enter the code from your email.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code,
      type: "signup",
    });
    setLoading(false);

    if (error) {
      Alert.alert("Verification Failed", error.message);
    } else {
      Alert.alert("Success!", "Your account is verified.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {!otpSent ? (
          <>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join and start planning your meals</Text>

            <TextInput
              placeholder="Username"
              placeholderTextColor="#999"
              value={userName}
              onChangeText={setUserName}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={USERNAME_MAX}
              style={styles.input}
            />
            <TextInput
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              maxLength={EMAIL_MAX}
              style={styles.input}
            />
            <PasswordInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
            />
            <PasswordInput
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
            />
            <Text style={styles.hint}>
              At least 8 characters with letters and numbers.
            </Text>
            {confirmPassword.length > 0 && confirmPassword !== password && (
              <Text style={styles.mismatch}>Passwords do not match.</Text>
            )}

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>Send Verification OTP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/login")}
              style={{ marginTop: 20 }}
            >
              <Text style={{ color: ORANGE_DARK, textAlign: "center", fontWeight: "600" }}>
                Already have an account? Sign In
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter Code</Text>
            <Text style={styles.subtitle}>Sent to {normalizeEmail(email)}</Text>
            <TextInput
              placeholder="Verification code"
              placeholderTextColor="#999"
              value={token}
              onChangeText={(t) => setToken(t.replace(/\D/g, ""))}
              keyboardType="number-pad"
              maxLength={8}
              style={styles.input}
            />
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleVerifyOTP}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>Verify & Register</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: { fontSize: 28, fontWeight: "800", color: ORANGE_DARK },
  subtitle: { fontSize: 14, color: "#8E8E93", marginTop: 4, marginBottom: 24 },
  input: {
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#333",
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#FFF",
  },
  hint: { fontSize: 12, color: "#8E8E93", marginTop: -6, marginBottom: 14 },
  mismatch: { fontSize: 12, color: "#FF3B30", marginTop: -6, marginBottom: 14 },
  button: {
    backgroundColor: ORANGE,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
