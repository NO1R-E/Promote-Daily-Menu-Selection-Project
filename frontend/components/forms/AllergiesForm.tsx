// src/components/forms/AllergiesForm.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/src/config/supabase";
import { OnboardingFormData } from "@/src/types/OnboardingType";

type Tag = { tag_id: number; tag_name: string };

type Props = {
  initialData: Partial<OnboardingFormData>;
  buttonLabel: string;
  onSubmit: (data: Partial<OnboardingFormData>) => void;
  onBack?: () => void;
};

export default function AllergiesForm({
  initialData,
  buttonLabel,
  onSubmit,
  onBack,
}: Props) {
  const [options, setOptions] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<number[]>(
    initialData.filter_tags || [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadOptions = () => {
    setLoading(true);
    setLoadError(false);
    supabase
      .from("tags")
      .select("tag_id, tag_name")
      .eq("tag_category", "FILTER")
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

  const toggle = (tagId: number) => {
    setSelected((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
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
      <Text style={styles.title}>Allergies & Dietary Preferences</Text>
      <View style={styles.grid}>
        {options.map((tag) => {
          const isSelected = selected.includes(tag.tag_id);
          return (
            <TouchableOpacity
              key={tag.tag_id}
              onPress={() => toggle(tag.tag_id)}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, isSelected && styles.chipTextSelected]}
              >
                {tag.tag_name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => onSubmit({ filter_tags: selected })}
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFF",
  },
  chipSelected: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  chipText: { color: "#333", fontSize: 14 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
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
