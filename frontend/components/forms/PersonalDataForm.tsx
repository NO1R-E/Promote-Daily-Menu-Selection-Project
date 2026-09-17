// src/components/forms/PersonalDataForm.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { OnboardingFormData } from "@/src/types/OnboardingType";

const genderData = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];
const exerciseData = [
  { label: "Low", value: "low" },
  { label: "Moderate", value: "moderate" },
  { label: "High", value: "high" },
];

type Props = {
  initialData: Partial<OnboardingFormData>;
  buttonLabel: string;
  onSubmit: (data: Partial<OnboardingFormData>) => void;
  onBack?: () => void;
};

export default function PersonalDataForm({
  initialData,
  buttonLabel,
  onSubmit,
  onBack,
}: Props) {
  const [gender, setGender] = useState(initialData.gender || "");
  const [age, setAge] = useState(initialData.age || "");
  const [height, setHeight] = useState(initialData.height || "");
  const [weight, setWeight] = useState(initialData.weight || "");
  const [intensity, setIntensity] = useState(
    initialData.intensity_exercise || "",
  );

  const handleSubmit = () => {
    if (!gender || !age || !height || !weight || !intensity) {
      Alert.alert("Missing info", "Please fill in every field.");
      return;
    }
    onSubmit({
      gender: gender as OnboardingFormData["gender"],
      age,
      height,
      weight,
      intensity_exercise: intensity as OnboardingFormData["intensity_exercise"],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Personal Data</Text>

      <Text style={styles.label}>Gender</Text>
      <Dropdown
        style={styles.dropdown}
        data={genderData}
        labelField="label"
        valueField="value"
        placeholder="Select gender"
        value={gender}
        onChange={(item) => setGender(item.value)}
      />

      <Text style={styles.label}>Age</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={age}
        onChangeText={setAge}
        placeholder="Age"
      />

      <Text style={styles.label}>Height (cm)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={height}
        onChangeText={setHeight}
        placeholder="Height"
      />

      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={weight}
        onChangeText={setWeight}
        placeholder="Weight"
      />

      <Text style={styles.label}>Exercise Intensity</Text>
      <Dropdown
        style={styles.dropdown}
        data={exerciseData}
        labelField="label"
        valueField="value"
        placeholder="Select intensity"
        value={intensity}
        onChange={(item) => setIntensity(item.value)}
      />

      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.nextBtn} onPress={handleSubmit}>
          <Text style={styles.nextText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  dropdown: {
    height: 50,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  row: { flexDirection: "row", gap: 12, marginTop: 28 },
  backBtn: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#007AFF", fontWeight: "600" },
  nextBtn: {
    flex: 2,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: { color: "#fff", fontWeight: "600" },
});
