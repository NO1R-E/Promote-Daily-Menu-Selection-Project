import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MEAL_LABEL, MEAL_TYPES, MealType } from "@/src/api/record";

type Props = {
  visible: boolean;
  suggested: MealType;
  loggedTypes: Set<string>;
  onPick: (type: MealType) => void;
  onClose: () => void;
};

const HINT: Record<MealType, string> = {
  breakfast: "First meal of the day",
  lunch: "Midday meal",
  dinner: "Evening meal",
  snack: "Anything outside your main meals",
};

export default function RecordMealSheet({
  visible,
  suggested,
  loggedTypes,
  onPick,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <Text style={styles.title}>Which meal was this?</Text>
          {MEAL_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.option,
                type === suggested && styles.optionSuggested,
              ]}
              onPress={() => onPick(type)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{MEAL_LABEL[type]}</Text>
                <Text style={styles.optionHint}>{HINT[type]}</Text>
              </View>
              {type === suggested ? (
                <Text style={styles.suggestedTag}>Suggested</Text>
              ) : loggedTypes.has(type) ? (
                <Text style={styles.loggedTag}>Logged today</Text>
              ) : null}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#1C1C1E", marginBottom: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  optionSuggested: { borderColor: "#FF7A00", backgroundColor: "#FFF8F0" },
  optionTitle: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  optionHint: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  suggestedTag: { fontSize: 12, fontWeight: "600", color: "#FF7A00" },
  loggedTag: { fontSize: 12, color: "#8E8E93" },
  cancel: { alignItems: "center", paddingVertical: 10 },
  cancelText: { color: "#FF7A00", fontWeight: "600", fontSize: 15 },
});
