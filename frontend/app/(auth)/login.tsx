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
  View,
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
  normalizeEmail,
  validateEmail,
} from "@/src/utils/authValidation";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (loading) return;
    const emailError = validateEmail(email);
    if (emailError) {
      Alert.alert("Check your details", emailError);
      return;
    }
    if (!password) {
      Alert.alert("Check your details", "Password is required.");
      return;
    }
    if (password.length > PASSWORD_MAX) {
      Alert.alert("Check your details", "Email or password is incorrect.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Login Failed", error.message);
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
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

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
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/register")}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: ORANGE_DARK, textAlign: "center", fontWeight: "600" }}>
            Don't have an account? Sign Up
          </Text>
        </TouchableOpacity>
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
  button: {
    backgroundColor: ORANGE,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
