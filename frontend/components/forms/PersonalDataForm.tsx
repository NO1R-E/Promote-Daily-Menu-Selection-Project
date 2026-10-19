// src/components/forms/PersonalDataForm.tsx
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Personal details</Text>
        <Text style={styles.subtitle}>
          A few basics to help us tailor your plan.
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Gender</Text>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              data={genderData}
              labelField="label"
              valueField="value"
              placeholder="Select"
              value={gender}
              onChange={(item) => setGender(item.value)}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              placeholder="Years"
              placeholderTextColor="#B0B0B5"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={height}
              onChangeText={setHeight}
              placeholder="cm"
              placeholderTextColor="#B0B0B5"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={weight}
              onChangeText={setWeight}
              placeholder="kg"
              placeholderTextColor="#B0B0B5"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Exercise intensity</Text>
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            data={exerciseData}
            labelField="label"
            valueField="value"
            placeholder="Select intensity"
            value={intensity}
            onChange={(item) => setIntensity(item.value)}
          />
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.nextBtn} activeOpacity={0.85} onPress={handleSubmit}>
          <Text style={styles.nextText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA", padding: 24, paddingTop: 56 },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: "700", color: "#1C1C1E" },
  subtitle: { fontSize: 14, color: "#8A8A8E", marginTop: 6, lineHeight: 20 },

  scrollContent: { paddingBottom: 12 },

  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1, marginBottom: 18 },
  fieldGroup: { marginBottom: 18 },

  label: { fontSize: 13, fontWeight: "600", color: "#3A3A3C", marginBottom: 8 },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#1C1C1E",
  },
  dropdown: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  placeholderStyle: { fontSize: 15, color: "#B0B0B5" },
  selectedTextStyle: { fontSize: 15, color: "#1C1C1E" },

  buttonRow: { flexDirection: "row", gap: 12, paddingTop: 16 },
  backBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#007AFF", fontWeight: "700", fontSize: 15 },
  nextBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nextText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
