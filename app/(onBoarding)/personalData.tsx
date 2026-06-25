import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

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

export default function PersonalDataScreen() {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [intensityExercise, setIntensityExercise] = useState("");
  const router = useRouter();

  const handlePersonalData = async () => {
    const parsedAge = Number(age);
    const parsedHeight = Number(height);
    const parsedWeight = Number(weight);

    /*if (!gender || !age || !height || !weight || !intensityExercise) {
      Alert.alert("Validation Error", "Please fill in all fields.");
      return;
    }
    
    if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 100) {
      Alert.alert("Validation Error", "Please enter a valid age (1-100).");
      return;
    }

    if (isNaN(parsedHeight) || parsedHeight <= 0 || parsedHeight > 300) {
      Alert.alert("Validation Error", "Please enter a valid height.");
      return;
    }

    if (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 300) {
      Alert.alert("Validation Error", "Please enter a valid weight.");
      return;
    }*/

    
    router.replace("/(onboarding)/allergies");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      <Text style={styles.title}>Personal Data</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Gender</Text>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
          containerStyle={styles.dropdownContainer}
          data={genderData}
          labelField="label"
          valueField="value"
          placeholder="Select gender"
          value={gender}
          onChange={(item) => setGender(item.value)}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Age</Text>
        <TextInput
          placeholder="Enter your age"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          style={styles.input}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Height (cm)</Text>
        <TextInput
          placeholder="Enter your height"
          value={height}
          onChangeText={setHeight}
          keyboardType="number-pad"
          style={styles.input}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          placeholder="Enter your weight"
          value={weight}
          onChangeText={setWeight}
          keyboardType="number-pad"
          style={styles.input}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Intensity of Exercise</Text>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
          containerStyle={styles.dropdownContainer}
          data={exerciseData}
          labelField="label"
          valueField="value"
          placeholder="Select intensity"
          value={intensityExercise}
          onChange={(item) => setIntensityExercise(item.value)}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handlePersonalData}>
        <Text style={styles.btnText}>Next</Text>
      </TouchableOpacity>
    </ScrollView>
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
    textAlign: "left",
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
