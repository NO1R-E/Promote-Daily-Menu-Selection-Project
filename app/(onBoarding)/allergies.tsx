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

export default function AllergiesScreen() {
    const [allergies, setAllergies] = useState("");
    const router = useRouter();

    const handleAllergies = async () => {
        /*if (!allergies.trim()) {
            Alert.alert("Validation Error", "Please fill in the allergies field.");
            return;
        }*/
        router.replace("/preference");
    }
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Allergies Data</Text>

            <Text style={styles.label}>Allergies</Text>
            <TextInput
                placeholder="Enter your allergies"
                value={allergies}
                onChangeText={setAllergies}
                autoCapitalize="none"
                style={styles.input}
            />
            <TouchableOpacity style={styles.button}
                onPress={handleAllergies}>
                <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F8F9FA", 
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#1A1A1A",
    textAlign: "left"
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A4A4A",
    marginBottom: 6, 
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    borderRadius: 10,
    fontSize: 16,
    color: "#333",
  },
  button: {
    backgroundColor: "#007AFF",
    width: "100%",
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
});