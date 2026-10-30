// src/components/forms/AllergiesForm.tsx
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { OnboardingFormData } from "@/src/types/OnboardingType";

type Tag = { tag_id: number; tag_name: string; group_id: number };

type Props = {
  initialData: Partial<OnboardingFormData>;
  buttonLabel: string;
  onSubmit: (data: Partial<OnboardingFormData>) => void;
  onBack?: () => void;
};

// group_id ในตาราง tag_groups (tags.group_id เชื่อมมาที่ตารางนี้)
const ALLERGEN_GROUP_ID = 6; // group_name = Allergen
const DIET_GROUP_ID = 7; // group_name = Diet

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
      .select("tag_id, tag_name, group_id")
      .in("group_id", [ALLERGEN_GROUP_ID, DIET_GROUP_ID])
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

  const allergyOptions = options.filter((t) => t.group_id === ALLERGEN_GROUP_ID);
  const dietaryOptions = options
    .filter((t) => t.group_id === DIET_GROUP_ID)
    .filter((t) => !t.tag_name.startsWith("Non-")); // ตัด Non- ออก

  const renderChip = (tag: Tag) => {
    const isSelected = selected.includes(tag.tag_id);
    return (
      <TouchableOpacity
        key={tag.tag_id}
        onPress={() => toggle(tag.tag_id)}
        activeOpacity={0.8}
        style={[styles.chip, isSelected && styles.chipSelected]}
      >
        {isSelected && (
          <Ionicons name="checkmark" size={14} color="#fff" style={styles.chipIcon} />
        )}
        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
          {tag.tag_name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Allergies & Dietary</Text>
        <Text style={styles.subtitle}>
          Pick anything that applies — you can update this anytime.
        </Text>
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

      {!loading && !loadError && allergyOptions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Allergies</Text>
          <View style={styles.grid}>{allergyOptions.map(renderChip)}</View>
        </View>
      )}

      {!loading && !loadError && dietaryOptions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dietary preferences</Text>
          <View style={styles.grid}>{dietaryOptions.map(renderChip)}</View>
        </View>
      )}

      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.nextBtn}
          activeOpacity={0.85}
          onPress={() => onSubmit({ filter_tags: selected })}
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

  centerBlock: { paddingVertical: 20, alignItems: "center" },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8A8A8E",
    marginBottom: 10,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
  },
  chipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  chipIcon: { marginRight: 5 },
  chipText: { color: "#3A3A3C", fontSize: 14, fontWeight: "500" },
  chipTextSelected: { color: "#fff", fontWeight: "700" },

  row: { flexDirection: "row", gap: 12, marginTop: "auto", paddingTop: 20 },
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

  errorBox: {
    padding: 14,
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: { color: "#7A5B00", fontSize: 13, marginBottom: 6 },
  retryText: { color: "#007AFF", fontWeight: "700", fontSize: 13 },
  emptyText: {
    color: "#999",
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 20,
  },
});
