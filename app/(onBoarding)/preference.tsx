import { supabase } from "@/src/lib/supabase";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Dropdown } from 'react-native-element-dropdown';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const preferenceData = [
  { label: 'Normal', value: '1' },
  { label: 'Halal', value: '2' },
  { label: 'Jiae', value: '3' },
  { label: 'Vegetarian', value: '4' },
  { label: 'Lacto Vegetarian', value: '5' },
  { label: 'Lacto Ovo Vegetarian', value: '6' },
  { label: 'Pescatarian', value: '7' },
  { label: 'Keto', value: '8' },
];
export default function PreferenceScreen() {
  const allParams = useLocalSearchParams();
  const [preference, setPreference] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const handlePreference = async () => {
    if (!preference) {
        Alert.alert("Validation Error", "Please select a dietary preference.");
        return;
    }
    setIsLoading(true);
    try {
      // 1. ดึง ID ของ User ปัจจุบันก่อน
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("User not found.");

      // 2. บันทึกข้อมูลรวดเดียวลง Table 'personalData' ตามที่คุณตั้งชื่อไว้
      const { error: dbError } = await supabase
        .from("personalData") // 👈 ชื่อ Table ใน Supabase ของคุณ
        .upsert({
          user_id: user.id, // ผูก ID
          // ข้อมูลจากหน้า 1 (แปลงชนิดข้อมูลให้ตรงกับใน DB ด้วย เช่น Number)
          gender: allParams.gender,
          age: Number(allParams.age),
          height: Number(allParams.height),
          weight: Number(allParams.weight),
          intensity_exercise: allParams.intensityExercise,
          // ข้อมูลจากหน้า 2
          allergies: allParams.allergies,
          // ข้อมูลจากหน้า 3 (หน้าปัจจุบัน)
          dietary_preference: preference,
          created_at: new Date(),
        });

      if (dbError) throw dbError;

      Alert.alert("Success", "Onboarding completed!");
      // พากลับเข้าหน้าแอปหลัก
      router.replace("/(app)/(tabs)/chatbot");

    } catch (error: any) {
      Alert.alert("Error Saving", error.message);
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preference Data</Text>
      <Text style={styles.label}>Dietary Preference</Text>
      <Dropdown
        style={styles.dropdown}
        placeholderStyle={styles.placeholderStyle}
        selectedTextStyle={styles.selectedTextStyle}
        inputSearchStyle={styles.input}
        data={preferenceData}
        labelField="label"
        valueField="value"
        placeholder="Select preference"
        value={preference}
        onChange={item => {
          setPreference(item.value);
        }}
      />
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.back()}
      >
        <Text style={styles.btnText}>Back</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button}
        onPress={handlePreference}>
        <Text style={styles.btnText}>Submit</Text>
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
  dropdown: {
    width: "100%",
    height: 50,
    borderColor: '#E0E0E0',
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  dropdownContainer: {
    borderRadius: 10,
  },
  placeholderStyle: {
    fontSize: 16,
    color: '#999',
  },
  selectedTextStyle: {
    fontSize: 16,
    color: '#333',
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
