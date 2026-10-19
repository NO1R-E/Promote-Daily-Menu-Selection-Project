// src/components/forms/PreferenceForm.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { OnboardingFormData, UserPref } from "@/src/types/OnboardingType";

type Tag = { tag_id: number; tag_name: string };

type Props = {
  initialData: Partial<OnboardingFormData>;
  buttonLabel: string;
  onSubmit: (data: Partial<OnboardingFormData>) => void;
  onBack?: () => void;
  disabled?: boolean;
};

export default function PreferenceForm({
  initialData,
  buttonLabel,
  onSubmit,
  onBack,
  disabled,
}: Props) {
  const [options, setOptions] = useState<Tag[]>([]);
  const [prefs, setPrefs] = useState<UserPref[]>(initialData.user_prefs || []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadOptions = () => {
    setLoading(true);
    setLoadError(false);
    supabase
      .from("tags")
      .select("tag_id, tag_name")
      .eq("tag_category", "LIKING")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error loading filter tags:", error);
          setLoadError(true);
        } else {
          setOptions(data || []);
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const getVector = (tagId: number) =>
    prefs.find((p) => p.tag_id === tagId)?.vector;

  const setVector = (tagId: number, vector: number) => {
    setPrefs((prev) => {
      const rest = prev.filter((p) => p.tag_id !== tagId);
      // tapping the already-selected value clears it back to neutral/skipped
      if (getVector(tagId) === vector) return rest;
      return [...rest, { tag_id: tagId, vector }];
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>What do you like?</Text>
        <Text style={styles.subtitle}>Tap like or dislike — skip anything you're unsure about.</Text>
      </View>

      {loading && (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}

      {loadError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Couldn't load options. Check your connection.</Text>
          <TouchableOpacity onPress={loadOptions}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !loadError && options.length === 0 && (
        <Text style={styles.emptyText}>No options available right now.</Text>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {options.map((tag) => {
          const v = getVector(tag.tag_id);
          return (
            <View key={tag.tag_id} style={styles.questionCard}>
              <Text style={styles.questionText}>{tag.tag_name}</Text>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.thumbBtn, v === 1 && styles.likeSelected]}
                  activeOpacity={0.8}
                  onPress={() => setVector(tag.tag_id, 1)}
                >
                  <Ionicons
                    name="thumbs-up"
                    size={16}
                    color={v === 1 ? "#fff" : "#34C759"}
                    style={styles.thumbIcon}
                  />
                  <Text style={v === 1 ? styles.thumbTextSelected : styles.thumbText}>
                    Like
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.thumbBtn, v === -1 && styles.dislikeSelected]}
                  activeOpacity={0.8}
                  onPress={() => setVector(tag.tag_id, -1)}
                >
                  <Ionicons
                    name="thumbs-down"
                    size={16}
                    color={v === -1 ? "#fff" : "#FF3B30"}
                    style={styles.thumbIcon}
                  />
                  <Text style={v === -1 ? styles.thumbTextSelected : styles.thumbText}>
                    Dislike
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.buttonRow}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, disabled && styles.nextBtnDisabled]}
          activeOpacity={0.85}
          disabled={disabled}
          onPress={() => onSubmit({ user_prefs: prefs })}
        >
          <Text style={styles.nextText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA", padding: 24, paddingTop: 56 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#1C1C1E" },
  subtitle: { fontSize: 14, color: "#8A8A8E", marginTop: 6, lineHeight: 20 },

  centerBlock: { paddingVertical: 20, alignItems: "center" },

  scrollContent: { paddingBottom: 12 },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  questionText: { fontSize: 15, fontWeight: "600", color: "#1C1C1E", marginBottom: 10 },
  btnRow: { flexDirection: "row", gap: 10 },
  thumbBtn: {
    flex: 1,
    flexDirection: "row",
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbIcon: { marginRight: 6 },
  likeSelected: { backgroundColor: "#34C759", borderColor: "#34C759" },
  dislikeSelected: { backgroundColor: "#FF3B30", borderColor: "#FF3B30" },
  thumbText: { color: "#3A3A3C", fontSize: 14, fontWeight: "500" },
  thumbTextSelected: { color: "#fff", fontWeight: "700" },

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
  nextBtnDisabled: { backgroundColor: "#B7D6FF", shadowOpacity: 0 },
  nextText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  errorBox: {
    padding: 14,
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: { color: "#7A5B00", fontSize: 13, marginBottom: 6 },
  retryText: { color: "#007AFF", fontWeight: "700", fontSize: 13 },
  emptyText: {
    color: "#999",
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 16,
  },
});
