import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Dropdown } from "react-native-element-dropdown";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";  

const genderOptions = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

const exerciseOptions = [
  { label: "Low", value: "low" },
  { label: "Moderate", value: "moderate" },
  { label: "High", value: "high" },
];

const goalOptions = [
  { label: "Lose Weight", value: "lose_weight" },
  { label: "Maintain Weight", value: "maintain_weight" },
  { label: "Build Muscle", value: "build_muscle" },
];

// [TAG GROUP] group_id ในตาราง tag_groups (tags.group_id เชื่อมมาที่ตารางนี้)
const ALLERGEN_GROUP_ID = 6; // group_name = Allergen
const DIET_GROUP_ID = 7; // group_name = Diet

// gender กับ intensity_exercise เก็บเป็น enum (string) ใน DB ตรงๆ เลยไม่ต้อง map ผ่านตัวเลขแบบ dietary_pref
const getOptionLabel = (options: { label: string; value: string }[], value: string) => {
  const found = options.find((opt) => opt.value === value);
  return found ? found.label : "-";
};

export default function DisplayPersonalDataScreen() {
  const router = useRouter();

  // 👈 2. ดึง personalData, user, refreshUserData จาก AuthContext
  const { personalData, user, refreshUserData, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // State สำหรับ Personal Data
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [intensityExercise, setIntensityExercise] = useState("");
  const [goal, setGoal] = useState("");

  // ตัวเลือกแท็กทั้งหมดของแต่ละกลุ่ม (โหลดครั้งเดียว ใช้แสดงเป็น chip ให้กดเลือกตอนแก้ไข)
  const [allergyOptions, setAllergyOptions] = useState<{ tag_id: any; tag_name: string }[]>([]);
  const [dietOptions, setDietOptions] = useState<{ tag_id: any; tag_name: string }[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  // แท็กที่ผู้ใช้เลือกอยู่ (Food Allergies / Dietary Preferences)
  const [selectedAllergies, setSelectedAllergies] = useState<{ tag_id: any; tag_name: string }[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<{ tag_id: any; tag_name: string }[]>([]);

  // 👈 3. ฟังก์ชันกำหนดค่า Personal Data จาก Context
  const syncPersonalDataFromContext = () => {
    if (personalData) {
      setGender(String(personalData.gender || ""));
      setAge(String(personalData.age || ""));
      setHeight(String(personalData.height || ""));
      setWeight(String(personalData.weight || ""));
      setIntensityExercise(String(personalData.intensity_exercise || ""));
      setGoal(String(personalData.goal || ""));
    }
  };

  // 👈 4. Fetch เฉพาะ Allergies + Dietary จาก Supabase (เพราะ Context ยังไม่ได้เก็บไว้)
  const fetchAllergies = async () => {
    try {
      setLoading(true);
      if (!user) return;

      const { data: allergiesData, error } = await supabase
        .from("user_filter")
        .select("tag_id, tags(tag_id, tag_name, group_id)")
        .eq("user_id", user.id);

      if (error) throw error;

      const allergies: { tag_id: any; tag_name: string }[] = [];
      const diets: { tag_id: any; tag_name: string }[] = [];

      (allergiesData || []).forEach((item: any) => {
        if (!item.tags) return;
        const tagObj = { tag_id: item.tags.tag_id, tag_name: item.tags.tag_name };
        // [TAG GROUP] แยกประเภทด้วย group_id
        if (item.tags.group_id === DIET_GROUP_ID) {
          if (!item.tags.tag_name.startsWith("Non-")) { // ตัด Non- ออก
            diets.push(tagObj);
          }
        } else if (item.tags.group_id === ALLERGEN_GROUP_ID) {
          allergies.push(tagObj);
        }
      });

      setSelectedAllergies(allergies);
      setSelectedDiets(diets);
    } catch (err) {
      console.error("Error fetching allergies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncPersonalDataFromContext();
    fetchAllergies();
  }, [personalData, user]);

  // โหลดตัวเลือกแท็กทั้งหมด (Allergen + Diet) ครั้งเดียว ไว้แสดงเป็น chip ให้เลือกตอนแก้ไข
  useEffect(() => {
    const fetchTagOptions = async () => {
      setTagsLoading(true);
      try {
        const { data, error } = await supabase
          .from("tags")
          .select("tag_id, tag_name, group_id")
          .in("group_id", [ALLERGEN_GROUP_ID, DIET_GROUP_ID]) // [TAG GROUP]
          .order("tag_name", { ascending: true });

        if (error) throw error;

        const rows: any[] = data || [];
        setAllergyOptions(
          rows
            .filter((t) => t.group_id === ALLERGEN_GROUP_ID)
            .map((t) => ({ tag_id: t.tag_id, tag_name: t.tag_name }))
        );
        setDietOptions(
          rows
            .filter((t) => t.group_id === DIET_GROUP_ID && !/^non-/i.test(t.tag_name)) // ตัด Non- ออก
            .map((t) => ({ tag_id: t.tag_id, tag_name: t.tag_name }))
        );
      } catch (err) {
        console.error("Error fetching tag options:", err);
      } finally {
        setTagsLoading(false);
      }
    };

    fetchTagOptions();
  }, []);

  // กด chip เพื่อเลือก/ยกเลิก
  const toggleAllergy = (tag: { tag_id: any; tag_name: string }) => {
    setSelectedAllergies((prev) =>
      prev.some((t) => t.tag_id === tag.tag_id) ? prev.filter((t) => t.tag_id !== tag.tag_id) : [...prev, tag]
    );
  };

  const toggleDiet = (tag: { tag_id: any; tag_name: string }) => {
    setSelectedDiets((prev) =>
      prev.some((t) => t.tag_id === tag.tag_id) ? prev.filter((t) => t.tag_id !== tag.tag_id) : [...prev, tag]
    );
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // แสดง chip ของแท็ก: โหมดแก้ไข = แสดงตัวเลือกทั้งหมดให้กดเลือก/ยกเลิก, โหมดดู = แสดงเฉพาะที่เลือกไว้
  const renderTagChips = (
    options: { tag_id: any; tag_name: string }[],
    selected: { tag_id: any; tag_name: string }[],
    onToggle: (tag: { tag_id: any; tag_name: string }) => void
  ) => {
    if (isEditing) {
      if (tagsLoading) return <ActivityIndicator size="small" color="#FF7A00" />;
      if (options.length === 0) return <Text style={styles.noneText}>No options available</Text>;

      return options.map((tag) => {
        const isSelected = selected.some((t) => t.tag_id === tag.tag_id);
        return (
          <TouchableOpacity
            key={String(tag.tag_id)}
            activeOpacity={0.8}
            disabled={saving}
            onPress={() => onToggle(tag)}
            style={[styles.chip, styles.chipOption, isSelected && styles.chipSelected]}
          >
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{tag.tag_name}</Text>
          </TouchableOpacity>
        );
      });
    }

    if (selected.length === 0) return <Text style={styles.noneText}>None</Text>;

    return selected.map((tag) => (
      <View key={String(tag.tag_id)} style={styles.chip}>
        <Text style={styles.chipText}>{tag.tag_name}</Text>
      </View>
    ));
  };

  // บันทึกข้อมูลทั้งหมด
  const handleSave = async () => {
    if (!gender || !age || !height || !weight || !intensityExercise || !goal) {
      Alert.alert("Validation Error", "Please fill in all personal data fields.");
      return;
    }

    setSaving(true);
    try {
      if (!user) return;

      // 1. Update personalData
      const { error: personalError } = await supabase.from("personalData").upsert(
        {
          personal_id: user.id,
          gender: gender,
          age: Number(age),
          height: Number(height),
          weight: Number(weight),
          intensity_exercise: intensityExercise,
          goal: goal,
        },
        { onConflict: "personal_id" }
      );

      if (personalError) throw personalError;

      // 2. Update Allergies + Dietary tags (user_filter) - รวมสองฝั่งแล้วบันทึกทีเดียว
      const { error: deleteError } = await supabase
        .from("user_filter")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      const allSelectedTags = [...selectedAllergies, ...selectedDiets];

      if (allSelectedTags.length > 0) {
        const recordsToInsert = allSelectedTags.map((tag) => ({
          user_id: user.id,
          tag_id: tag.tag_id,
        }));

        const { error: insertError } = await supabase
          .from("user_filter")
          .insert(recordsToInsert);

        if (insertError) throw insertError;
      }

      // 👈 5. เรียก refreshUserData เพื่ออัปเดต AuthContext ให้ได้ค่าล่าสุด
      await refreshUserData();

      Alert.alert("Success", "Profile data updated successfully.");
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update data.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.mainContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FF7A00" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personal Data</Text>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (isEditing) {
                syncPersonalDataFromContext(); // ยกเลิกการแก้ไข ให้ดึงค่าเดิมจาก Context
                fetchAllergies();
              }
              setIsEditing(!isEditing);
            }}
          >
            <Ionicons name={isEditing ? "close" : "pencil"} size={22} color="#FF7A00" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Gender & Age */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Gender</Text>
              {isEditing ? (
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.placeholderStyle}
                  selectedTextStyle={styles.selectedTextStyle}
                  data={genderOptions}
                  labelField="label"
                  valueField="value"
                  placeholder="Select gender"
                  value={gender}
                  onChange={(item) => setGender(item.value)}
                />
              ) : (
                <TextInput style={styles.input} value={getOptionLabel(genderOptions, gender)} editable={false} />
              )}
            </View>
  
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={[styles.input, isEditing && styles.activeInput]}
                value={age}
                onChangeText={setAge}
                editable={isEditing}
                keyboardType="number-pad"
              />
            </View>
          </View>
  
          {/* Height & Weight */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={[styles.input, isEditing && styles.activeInput]}
                value={height}
                onChangeText={setHeight}
                editable={isEditing}
                keyboardType="number-pad"
              />
            </View>
  
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={[styles.input, isEditing && styles.activeInput]}
                value={weight}
                onChangeText={setWeight}
                editable={isEditing}
                keyboardType="number-pad"
              />
            </View>
          </View>
  
          {/* Intensity Exercise */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Intensity Exercise</Text>
            {isEditing ? (
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                data={exerciseOptions}
                labelField="label"
                valueField="value"
                placeholder="Select intensity"
                value={intensityExercise}
                onChange={(item) => setIntensityExercise(item.value)}
              />
            ) : (
              <TextInput style={styles.input} value={getOptionLabel(exerciseOptions, intensityExercise)} editable={false} />
            )}
          </View>
  
          {/* Goal */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Goal</Text>
            {isEditing ? (
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                data={goalOptions}
                labelField="label"
                valueField="value"
                placeholder="Select goal"
                value={goal}
                onChange={(item) => setGoal(item.value)}
              />
            ) : (
              <TextInput style={styles.input} value={getOptionLabel(goalOptions, goal)} editable={false} />
            )}
          </View>


          {/* 🥑 Food Allergies Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Food Allergies</Text>
            <View style={styles.chipsContainer}>
              {renderTagChips(allergyOptions, selectedAllergies, toggleAllergy)}
            </View>
          </View>

          {/* 🥦 Dietary Preferences Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dietary Preferences</Text>
            <View style={styles.chipsContainer}>
              {renderTagChips(dietOptions, selectedDiets, toggleDiet)}
            </View>
          </View>

          {/* Save Button */}
          {isEditing && (
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    paddingTop: 50,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  iconButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FF7A00",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfWidth: {
    width: "48%",
  },
  inputGroup: {
    marginBottom: 16,
    width: "100%",
  },
  label: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    backgroundColor: "#F5F5F7",
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 15,
    color: "#666",
  },
  activeInput: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FF7A00",
    color: "#000",
  },
  dropdown: {
    width: "100%",
    height: 48,
    borderColor: "#FF7A00",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  placeholderStyle: {
    fontSize: 15,
    color: "#999",
  },
  selectedTextStyle: {
    fontSize: 15,
    color: "#333",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    borderColor: "#FFE0B2",
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  chipText: {
    color: "#FF7A00",
    fontSize: 14,
    fontWeight: "600",
  },
  // chip ตัวเลือกที่กดได้ (โหมดแก้ไข): ยังไม่เลือก = พื้นขาวขอบส้ม, เลือกแล้ว = พื้นส้มทึบ
  chipOption: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFB366",
  },
  chipSelected: {
    backgroundColor: "#FF7A00",
    borderColor: "#FF7A00",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  noneText: {
    fontSize: 15,
    color: "#999",
    fontStyle: "italic",
  },
  saveButton: {
    backgroundColor: "#FF7A00",
    width: "100%",
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});