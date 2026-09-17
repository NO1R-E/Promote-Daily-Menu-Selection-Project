// src/components/forms/PreferenceForm.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
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
    <View style={styles.container}>
      {loading && <ActivityIndicator size="small" color="#007AFF" />}
      {loadError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Couldn't load options. Check your connection.
          </Text>
          <TouchableOpacity onPress={loadOptions}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && !loadError && options.length === 0 && (
        <Text style={styles.emptyText}>No options available right now.</Text>
      )}
      <Text style={styles.title}>What do you like?</Text>
      {options.map((tag) => {
        const v = getVector(tag.tag_id);
        return (
          <View key={tag.tag_id} style={styles.questionRow}>
            <Text style={styles.questionText}>Do you like {tag.tag_name}?</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.thumbBtn, v === 1 && styles.likeSelected]}
                onPress={() => setVector(tag.tag_id, 1)}
              >
                <Text
                  style={v === 1 ? styles.thumbTextSelected : styles.thumbText}
                >
                  Like
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.thumbBtn, v === -1 && styles.dislikeSelected]}
                onPress={() => setVector(tag.tag_id, -1)}
              >
                <Text
                  style={v === -1 ? styles.thumbTextSelected : styles.thumbText}
                >
                  Dislike
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.nextBtn}
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
  container: { padding: 24 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  questionRow: { marginBottom: 16 },
  questionText: { fontSize: 15, marginBottom: 8 },
  btnRow: { flexDirection: "row", gap: 10 },
  thumbBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  likeSelected: { backgroundColor: "#34C759", borderColor: "#34C759" },
  dislikeSelected: { backgroundColor: "#FF3B30", borderColor: "#FF3B30" },
  thumbText: { color: "#333" },
  thumbTextSelected: { color: "#fff", fontWeight: "600" },
  row: { flexDirection: "row", gap: 12, marginTop: 20 },
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
  errorBox: {
    padding: 12,
    backgroundColor: "#FFF3CD",
    borderRadius: 10,
    marginVertical: 12,
  },
  errorText: { color: "#7A5B00", fontSize: 13, marginBottom: 6 },
  retryText: { color: "#007AFF", fontWeight: "600", fontSize: 13 },
  emptyText: {
    color: "#999",
    fontSize: 13,
    fontStyle: "italic",
    marginVertical: 12,
  },
});
