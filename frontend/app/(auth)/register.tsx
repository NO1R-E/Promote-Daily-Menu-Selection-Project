import { supabase } from "@/src/config/supabase";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState("");
  const router = useRouter();

  const checkUsernameExists = async (username: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username.trim())
      .maybeSingle();
    if (error) {
      console.error("Error checking username:", error.message);
      return false;
    }
    return data !== null;
  };

  const validateRegistrationInput = async () => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (await checkUsernameExists(userName)) {
      return "Username already exists. Please choose another.";
    }
    if (!userName || userName.trim() === "") {
      return "Username is required.";
    }
    if (!email || email.trim() === "") {
      return "Email is required.";
    }
    if (!password || password.trim() === "") {
      return "Password is required.";
    }
    if (!usernameRegex.test(userName)) {
      return "Username must be 3-20 characters long and can only contain letters, numbers, and underscores.";
    }
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address.";
    }
    return null;
  };

  const handleSignUp = async () => {
    const validationError = await validateRegistrationInput();
    if (validationError) {
      Alert.alert("Validation Error", validationError);
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: userName,
        },
      },
    });
    if (error) {
      Alert.alert("Signup Error", error.message);
    } else {
      Alert.alert("OTP Sent", "Check your email for the verification code.");
      setOtpSent(true);
    }
  };

  const handleVerifyOTP = async () => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });

    if (error) {
      Alert.alert("Verification Failed", error.message);
    } else {
      Alert.alert("Success!", "Your account is verified.");
    }
  };

  return (
    <View style={styles.container}>
      {!otpSent ? (
        <>
          <Text style={styles.title}>Create Account</Text>
          <TextInput
            placeholder="Username"
            value={userName}
            onChangeText={setUserName}
            style={styles.input}
          />
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <Text style={styles.btnText}>Send Verification OTP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/login")}
            style={{ marginTop: 20 }}
          >
            <Text style={{ color: "#007AFF", textAlign: "center" }}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>Enter Code</Text>
          <Text style={{ marginBottom: 10, color: "#666" }}>
            Sent to {email}
          </Text>
          <TextInput
            placeholder="6-digit OTP Token"
            value={token}
            onChangeText={setToken}
            keyboardType="number-pad"
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#34C759" }]}
            onPress={handleVerifyOTP}
          >
            <Text style={styles.btnText}>Verify & Register</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
