import React, { useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const COMMON_REASONS = [
  "Inappropriate Content",
  "Spam or Misleading",
  "Harassment or Bullying",
  "Intellectual Property / Copyright",
  "Other",
];

type ReportModalProps = {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
};

export default function ReportModal({
  visible,
  submitting,
  onClose,
  onSubmit,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");

  const resetAndClose = () => {
    setSelectedReason("");
    setCustomReason("");
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedReason) {
      Alert.alert("Select Reason", "Please select a reason for reporting.");
      return;
    }

    const finalReason =
      selectedReason === "Other"
        ? customReason.trim()
        : selectedReason +
          (customReason.trim() ? `: ${customReason.trim()}` : "");

    if (selectedReason === "Other" && !customReason.trim()) {
      Alert.alert(
        "Details Required",
        "Please specify your reason for reporting.",
      );
      return;
    }

    onSubmit(finalReason);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={resetAndClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Report Post</Text>
            <TouchableOpacity onPress={resetAndClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Please select a reason for reporting this post:
          </Text>

          {COMMON_REASONS.map((reason) => {
            const isSelected = selectedReason === reason;
            return (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonOption,
                  isSelected && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <Ionicons
                  name={isSelected ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={isSelected ? "#FF7A00" : "#999"}
                />
                <Text
                  style={[
                    styles.reasonText,
                    isSelected && styles.reasonTextSelected,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            );
          })}

          {(selectedReason === "Other" || selectedReason !== "") && (
            <TextInput
              style={styles.textInput}
              placeholder={
                selectedReason === "Other"
                  ? "Describe the issue..."
                  : "Additional comments (optional)"
              }
              placeholderTextColor="#999"
              value={customReason}
              onChangeText={setCustomReason}
              multiline
              numberOfLines={3}
            />
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "bold", color: "#333" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 16 },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    marginBottom: 8,
  },
  reasonOptionSelected: { borderColor: "#FF7A00", backgroundColor: "#FFF5EC" },
  reasonText: { fontSize: 14, color: "#333", marginLeft: 10 },
  reasonTextSelected: { fontWeight: "600", color: "#FF7A00" },
  textInput: {
    borderWidth: 1,
    borderColor: "#EBEBEB",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    color: "#333",
    textAlignVertical: "top",
    minHeight: 70,
  },
  submitBtn: {
    backgroundColor: "#FF7A00",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#FFF", fontSize: 15, fontWeight: "bold" },
});
