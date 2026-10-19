// src/components/forms/GoalForm.tsx
import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OnboardingFormData, Goal } from "@/src/types/OnboardingType";

const goals: { label: string; value: Goal; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    label: "Lose weight",
    value: "lose_weight",
    description: "Eat in a moderate calorie deficit",
    icon: "trending-down-outline",
  },
  {
    label: "Build muscle",
    value: "build_muscle",
    description: "Prioritize protein and strength",
    icon: "barbell-outline",
  },
  {
    label: "Maintain weight",
    value: "maintain_weight",
    description: "Keep things steady as they are",
    icon: "reorder-two-outline",
  },
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
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>What's your goal?</Text>
        <Text style={styles.subtitle}>Pick the one that fits you best right now.</Text>
      </View>

      <View style={styles.optionList}>
        {goals.map((g) => {
          const isSelected = goal === g.value;
          return (
            <TouchableOpacity
              key={g.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              activeOpacity={0.85}
              onPress={() => setGoal(g.value)}
            >
              <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                <Ionicons
                  name={g.icon}
                  size={20}
                  color={isSelected ? "#fff" : "#007AFF"}
                />
              </View>
              <View style={styles.optionTextBlock}>
                <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                  {g.label}
                </Text>
                <Text style={styles.optionDescription}>{g.description}</Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={22} color="#007AFF" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, !goal && styles.nextBtnDisabled]}
          activeOpacity={0.85}
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
  screen: { flex: 1, backgroundColor: "#F8F9FA", padding: 24, paddingTop: 56 },
  header: { marginBottom: 28 },
  title: { fontSize: 24, fontWeight: "700", color: "#1C1C1E" },
  subtitle: { fontSize: 14, color: "#8A8A8E", marginTop: 6, lineHeight: 20 },

  optionList: { gap: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    borderRadius: 16,
    padding: 14,
  },
  optionSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F7FF",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  iconCircleSelected: { backgroundColor: "#007AFF" },
  optionTextBlock: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  optionTitleSelected: { color: "#007AFF" },
  optionDescription: { fontSize: 13, color: "#8A8A8E", marginTop: 2 },

  buttonRow: { flexDirection: "row", gap: 12, marginTop: "auto", paddingTop: 20 },
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
  nextBtnDisabled: { backgroundColor: "#B7D6FF", shadowOpacity: 0 },
  nextText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
