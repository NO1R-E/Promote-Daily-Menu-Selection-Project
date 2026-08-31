import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Dropdown } from "react-native-element-dropdown";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext"; // 👈 1. Import useAuth

const genderOptions = [
  { label: "Male", value: "1" },
  { label: "Female", value: "2" },
  { label: "Other", value: "3" },
];

const exerciseOptions = [
  { label: "Low", value: "1" },
  { label: "Moderate", value: "2" },
  { label: "High", value: "3" },
];

const preferenceOptions = [
  { label: "Normal", value: "1" },
  { label: "Halal", value: "2" },
  { label: "Jiae", value: "3" },
  { label: "Vegetarian", value: "4" },
  { label: "Lacto Vegetarian", value: "5" },
  { label: "Lacto Ovo Vegetarian", value: "6" },
  { label: "Pescatarian", value: "7" },
  { label: "Keto", value: "8" },
];

const GENDER_MAP: Record<string, string> = { "1": "Male", "2": "Female", "3": "Other" };
const EXERCISE_MAP: Record<string, string> = { "1": "Low", "2": "Moderate", "3": "High" };
const PREFERENCE_MAP: Record<string, string> = {
  "1": "Normal", "2": "Halal", "3": "Jiae", "4": "Vegetarian",
  "5": "Lacto Vegetarian", "6": "Lacto Ovo Vegetarian", "7": "Pescatarian", "8": "Keto",
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
  const [preference, setPreference] = useState("");

  // State สำหรับ Allergies
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ tag_id: any; tag_name: string }[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<{ tag_id: any; tag_name: string }[]>([]);

  // 👈 3. ฟังก์ชันกำหนดค่า Personal Data จาก Context
  const syncPersonalDataFromContext = () => {
    if (personalData) {
      setGender(String(personalData.gender || ""));
      setAge(String(personalData.age || ""));
      setHeight(String(personalData.height || ""));
      setWeight(String(personalData.weight || ""));
      setIntensityExercise(String(personalData.intensity_exercise || ""));
      setPreference(String(personalData.dietary_pref || ""));
    }
  };

  // 👈 4. Fetch เฉพาะ Allergies จาก Supabase (เพราะ Context ยังไม่ได้เก็บไว้)
  const fetchAllergies = async () => {
    try {
      setLoading(true);
      if (!user) return;

      const { data: allergiesData, error } = await supabase
        .from("user_allergies")
        .select("tag_id, tags(tag_name)")
        .eq("user_id", user.id);

      if (error) throw error;

      if (allergiesData && allergiesData.length > 0) {
        const formattedTags = allergiesData.map((item: any) => ({
          tag_id: item.tag_id,
          tag_name: item.tags?.tag_name || "",
        }));
        setSelectedAllergies(formattedTags);
      } else {
        setSelectedAllergies([]);
      }
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

  // ค้นหา Tag อาหารที่แพ้เมื่อพิมพ์ค้นหา
  useEffect(() => {
    const fetchTags = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from("tags")
          .select("tag_id, tag_name")
          .ilike("tag_name", `%${searchQuery}%`)
          .limit(10);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error("Error fetching tags:", err);
      } finally {
        setSearchLoading(false);
      }
    };

    const timer = setTimeout(fetchTags, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectTag = (tag: { tag_id: any; tag_name: string }) => {
    if (!selectedAllergies.some((t) => t.tag_id === tag.tag_id)) {
      setSelectedAllergies([...selectedAllergies, tag]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveTag = (tagId: any) => {
    setSelectedAllergies(selectedAllergies.filter((t) => t.tag_id !== tagId));
  };

  // บันทึกข้อมูลทั้งหมด
  const handleSave = async () => {
    if (!gender || !age || !height || !weight || !intensityExercise || !preference) {
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
          gender: Number(gender),
          age: Number(age),
          height: Number(height),
          weight: Number(weight),
          intensity_exercise: Number(intensityExercise),
          dietary_pref: Number(preference),
        },
        { onConflict: "personal_id" }
      );

      if (personalError) throw personalError;

      // 2. Update Allergies (user_allergies)
      const { error: deleteError } = await supabase
        .from("user_allergies")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      if (selectedAllergies.length > 0) {
        const recordsToInsert = selectedAllergies.map((tag) => ({
          user_id: user.id,
          tag_id: tag.tag_id,
        }));

        const { error: insertError } = await supabase
          .from("user_allergies")
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
              <TextInput style={styles.input} value={GENDER_MAP[gender] || "-"} editable={false} />
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
            <TextInput style={styles.input} value={EXERCISE_MAP[intensityExercise] || "-"} editable={false} />
          )}
        </View>

        {/* Dietary Preference */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dietary Preference</Text>
          {isEditing ? (
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              data={preferenceOptions}
              labelField="label"
              valueField="value"
              placeholder="Select preference"
              value={preference}
              onChange={(item) => setPreference(item.value)}
            />
          ) : (
            <TextInput style={styles.input} value={PREFERENCE_MAP[preference] || "-"} editable={false} />
          )}
        </View>

        {/* 🥑 Food Allergies Section */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Food Allergies</Text>

          {isEditing && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search allergies..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchLoading && <ActivityIndicator style={styles.searchLoader} size="small" color="#FF7A00" />}

              {/* Dropdown Search Results */}
              {searchResults.length > 0 && (
                <View style={styles.searchResultsList}>
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => String(item.tag_id)}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.searchResultItem} onPress={() => handleSelectTag(item)}>
                        <Text style={styles.searchResultText}>{item.tag_name}</Text>
                      </TouchableOpacity>
                    )}
                    nestedScrollEnabled
                  />
                </View>
              )}
            </View>
          )}

          {/* Chips Display Section */}
          <View style={styles.chipsContainer}>
            {selectedAllergies.length > 0 ? (
              selectedAllergies.map((tag) => (
                <View key={String(tag.tag_id)} style={styles.chip}>
                  <Text style={styles.chipText}>{tag.tag_name}</Text>
                  {isEditing && (
                    <TouchableOpacity onPress={() => handleRemoveTag(tag.tag_id)}>
                      <Ionicons name="close-circle" size={16} color="#FF3B30" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.noneText}>None</Text>
            )}
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
  searchContainer: {
    position: "relative",
    marginBottom: 8,
    zIndex: 10,
  },
  searchInput: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#FF7A00",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 15,
    color: "#000",
  },
  searchLoader: {
    position: "absolute",
    right: 12,
    top: 14,
  },
  searchResultsList: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EBEBEB",
    borderRadius: 8,
    maxHeight: 160,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 100,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  searchResultText: {
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