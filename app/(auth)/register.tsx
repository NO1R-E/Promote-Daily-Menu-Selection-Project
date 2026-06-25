import { supabase } from "@/src/lib/supabase";
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

  const handleSignUp = async () => {
    // Pass custom profile data inside the options block to feed the database trigger
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_name: userName,
          role: "users", // Automatically assigns 'users'. Change to 'administrator' manually in DB if needed.
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
