import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { supabase } from "@/src/config/supabase"; // 👈 อย่าลืมตรวจสอบ path ของ supabase client

const genderData = [
  { label: "Male", value: "1" },
  { label: "Female", value: "2" },
  { label: "Other", value: "3" },
];

const exerciseData = [
  { label: "Low", value: "1" },
  { label: "Moderate", value: "2" },
  { label: "High", value: "3" },
];

const preferenceData = [
  { label: "Normal", value: "1" },
  { label: "Halal", value: "2" },
  { label: "Jiae", value: "3" },
  { label: "Vegetarian", value: "4" },
  { label: "Lacto Vegetarian", value: "5" },
  { label: "Lacto Ovo Vegetarian", value: "6" },
  { label: "Pescatarian", value: "7" },
  { label: "Keto", value: "8" },
];

export default function PersonalDataScreen() {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [intensityExercise, setIntensityExercise] = useState("");
  const [preference, setPreference] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ดึงข้อมูลเดิมมาแสดง
  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("personalData")
          .select("*")
          .eq("personal_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setGender(String(data.gender || ""));
          setAge(String(data.age || ""));
          setHeight(String(data.height || ""));
          setWeight(String(data.weight || ""));
          setIntensityExercise(String(data.intensity_exercise || ""));
          setPreference(String(data.dietary_pref || ""));
        }
      } catch (err) {
        console.error("Error fetching personal data:", err);
      }
    };

    fetchExistingData();
  }, []);
  
  const handlePersonalData = async () => {
    // 1. ตรวจสอบว่ากรอกข้อมูลครบทุกช่องหรือไม่
    if (!gender || !age || !height || !weight || !intensityExercise || !preference) {
      Alert.alert("Validation Error", "Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      // 2. ดึงข้อมูล User ปัจจุบันที่ Login อยู่จาก Supabase Auth
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Error", "User not authenticated. Please log in again.");
        return;
      }

      // 3. บันทึกข้อมูลลงตาราง personalData ใน Supabase
      const { error } = await supabase.from("personalData").upsert(
        {
          personal_id: user.id, // Primary Key หรือ Unique Key จาก auth.users
          gender: Number(gender),
          age: Number(age),
          height: Number(height),
          weight: Number(weight),
          intensity_exercise: Number(intensityExercise),
          dietary_pref: Number(preference),
        },
        { onConflict: "personal_id" } // ถ้ามีข้อมูลเดิมอยู่แล้วจะสลับเป็น UPDATE ให้อัตโนมัติ
      );

      if (error) throw error;

      // 4. สำเร็จแล้วไปหน้าถัดไป
      router.push("/(onboarding)/allergies");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save personal data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Personal Data</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Gender */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gender</Text>
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            containerStyle={styles.dropdownContainer}
            itemTextStyle={styles.dropdownItemText}
            data={genderData}
            labelField="label"
            valueField="value"
            placeholder="Select gender"
            value={gender}
            onChange={(item) => setGender(item.value)}
          />
        </View>

        {/* Age */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Age</Text>
          <TextInput
            placeholder="Enter your age"
            placeholderTextColor="#999"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        {/* Height */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput
            placeholder="Enter your height"
            placeholderTextColor="#999"
            value={height}
            onChangeText={setHeight}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        {/* Weight */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            placeholder="Enter your weight"
            placeholderTextColor="#999"
            value={weight}
            onChangeText={setWeight}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        {/* Intensity Exercise */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Intensity of Exercise</Text>
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            containerStyle={styles.dropdownContainer}
            itemTextStyle={styles.dropdownItemText}
            data={exerciseData}
            labelField="label"
            valueField="value"
            placeholder="Select intensity"
            value={intensityExercise}
            onChange={(item) => setIntensityExercise(item.value)}
          />
        </View>

        {/* Dietary Preference */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dietary Preference</Text>
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            containerStyle={styles.dropdownContainer}
            itemTextStyle={styles.dropdownItemText}
            data={preferenceData}
            labelField="label"
            valueField="value"
            placeholder="Select preference"
            value={preference}
            onChange={(item) => setPreference(item.value)}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.button} onPress={handlePersonalData} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Next</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingTop: 50,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1C1C1E",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 16,
    width: "100%",
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
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  dropdownContainer: {
    borderRadius: 10,
    borderColor: "#E0E0E0",
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#333",
  },
  placeholderStyle: {
    fontSize: 16,
    color: "#999",
  },
  selectedTextStyle: {
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
    fontWeight: "600",
  },
});