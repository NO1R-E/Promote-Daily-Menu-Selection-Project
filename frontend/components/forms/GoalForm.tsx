import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { OnboardingFormData, Goal } from "@/src/types/OnboardingType";

const goals: { label: string; value: Goal }[] = [
  { label: "Lose weight", value: "lose_weight" },
  { label: "Build muscle", value: "build_muscle" },
  { label: "Maintain weight", value: "maintain_weight" },
];

type Props = {
  initialData: Partial<OnboardingFormData>;
  buttonLabel: string;
  onSubmit: (data: Partial<OnboardingFormData>) => void;
  onBack?: () => void;
};

export default function GoalForm({
  initialData,
  buttonLabel,
  onSubmit,
  onBack,
}: Props) {
  const [goal, setGoal] = useState<Goal | "">(initialData.goal || "");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What's your goal?</Text>
      {goals.map((g) => (
        <TouchableOpacity
          key={g.value}
          style={[styles.option, goal === g.value && styles.optionSelected]}
          onPress={() => setGoal(g.value)}
        >
          <Text
            style={[
              styles.optionText,
              goal === g.value && styles.optionTextSelected,
            ]}
          >
            {g.label}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.nextBtn}
          disabled={!goal}
          onPress={() => onSubmit({ goal })}
        >
          <Text style={styles.nextText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  option: {
    height: 52,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  optionSelected: { borderColor: "#007AFF", backgroundColor: "#E1F0FF" },
  optionText: { fontSize: 15, color: "#333" },
  optionTextSelected: { color: "#007AFF", fontWeight: "600" },
  row: { flexDirection: "row", gap: 12, marginTop: 16 },
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
