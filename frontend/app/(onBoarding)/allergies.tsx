import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

interface TagItem {
  tag_id: any;
  tag_name: string;
}

export default function AllergiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // ALLERGIES 
  const [allergyQuery, setAllergyQuery] = useState("");
  const [allergyResults, setAllergyResults] = useState<TagItem[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<TagItem[]>([]);
  const [loadingAllergy, setLoadingAllergy] = useState(false);
  const [isAllergyFocused, setIsAllergyFocused] = useState(false);

  // DIETARY 
  const [dietQuery, setDietQuery] = useState("");
  const [dietResults, setDietResults] = useState<TagItem[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<TagItem[]>([]);
  const [loadingDiet, setLoadingDiet] = useState(false);
  const [isDietFocused, setIsDietFocused] = useState(false);

  const [saving, setSaving] = useState(false);

  // ดึงข้อมูลเดิม
  useEffect(() => {
    const fetchExistingData = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("user_allergies")
          .select("tag_id, tags(tag_id, tag_name)")
          .eq("user_id", user.id);

        if (error) throw error;

        if (data && data.length > 0) {
          const allergies: TagItem[] = [];
          const diets: TagItem[] = [];

          data.forEach((item: any) => {
            if (item.tags) {
              const tagObj = { tag_id: item.tags.tag_id, tag_name: item.tags.tag_name };
              if (["Halal", "Vegan", "Non-Jae"].includes(item.tags.tag_name)) {
                diets.push(tagObj);
              } else {
                allergies.push(tagObj);
              }
            }
          });

          setSelectedAllergies(allergies);
          setSelectedDiets(diets);
        }
      } catch (err) {
        console.error("Error loading existing data:", err);
      }
    };

    fetchExistingData();
  }, [user]);

  // ค้นหา tags 
  // ALLERGIES 
  useEffect(() => {
    const fetchAllergies = async () => {
      if (!isAllergyFocused) return;

      setLoadingAllergy(true);
      try {
        let query = supabase
          .from("tags")
          .select("tag_id, tag_name")
          .eq("tag_category", "FILTER")
          .not("tag_name", "in", "(Halal,Vegan,Non-Jae)");

        if (allergyQuery.trim()) {
          query = query.ilike("tag_name", `%${allergyQuery}%`);
        }

        const { data, error } = await query.limit(10);
        if (error) throw error;
        setAllergyResults(data || []);
      } catch (err) {
        console.error("Error fetching allergies:", err);
      } finally {
        setLoadingAllergy(false);
      }
    };

    const timer = setTimeout(fetchAllergies, 200);
    return () => clearTimeout(timer);
  }, [allergyQuery, isAllergyFocused]);

  // DIETARY
  useEffect(() => {
    const fetchDiets = async () => {
      if (!isDietFocused) return;

      setLoadingDiet(true);
      try {
        let query = supabase
          .from("tags")
          .select("tag_id, tag_name")
          .in("tag_name", ["Halal", "Vegan", "Non-Jae"]);

        if (dietQuery.trim()) {
          query = query.ilike("tag_name", `%${dietQuery}%`);
        }

        const { data, error } = await query.limit(10);
        if (error) throw error;
        setDietResults(data || []);
      } catch (err) {
        console.error("Error fetching diets:", err);
      } finally {
        setLoadingDiet(false);
      }
    };

    const timer = setTimeout(fetchDiets, 200);
    return () => clearTimeout(timer);
  }, [dietQuery, isDietFocused]);

  // เพิ่ม/ลบ tag ที่เลือกแล้ว 
  // ALLERGIES  
  const handleSelectAllergy = (tag: TagItem) => {
    if (!selectedAllergies.some((t) => t.tag_id === tag.tag_id)) {
      setSelectedAllergies([...selectedAllergies, tag]);
    }
    setAllergyQuery("");
    setIsAllergyFocused(false);
  };

  const handleRemoveAllergy = (tagId: any) => {
    setSelectedAllergies(selectedAllergies.filter((t) => t.tag_id !== tagId));
  };

  // DIETARY 
  const handleSelectDiet = (tag: TagItem) => {
    if (!selectedDiets.some((t) => t.tag_id === tag.tag_id)) {
      setSelectedDiets([...selectedDiets, tag]);
    }
    setDietQuery("");
    setIsDietFocused(false);
  };

  const handleRemoveDiet = (tagId: any) => {
    setSelectedDiets(selectedDiets.filter((t) => t.tag_id !== tagId));
  };

  // บันทึกข้อมูลและไปหน้าถัดไป
  const handleNext = async () => {
    if (!user) {
      Alert.alert("Error", "User not authenticated. Please log in again.");
      return;
    }

    setSaving(true);
    try {
      // 1. ลบรายการเดิมทั้งหมดออกก่อน
      await supabase.from("user_allergies").delete().eq("user_id", user.id);

      // 2. นำรายการที่เลือกทั้ง 2 ฝั่งมารวมกันเพื่อ Insert
      const allSelected = [...selectedAllergies, ...selectedDiets];

      if (allSelected.length > 0) {
        const recordsToInsert = allSelected.map((tag) => ({
          user_id: user.id,
          tag_id: tag.tag_id,
        }));

        const { error } = await supabase.from("user_allergies").insert(recordsToInsert);
        if (error) throw error;
      }

      router.push("/(onboarding)/preference");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save data");
    } finally {
      setSaving(false);
    }
  };

  const closeDropdowns = () => {
    setIsAllergyFocused(false);
    setIsDietFocused(false);
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={closeDropdowns}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dietary & Allergies</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* ALLERGIES */}
          <View style={[styles.sectionContainer, { zIndex: 20 }]}>
            <Text style={styles.label}>Allergies</Text>
            
            {/* Input & Dropdown */}
            <View style={styles.searchContainer}>
              <TextInput
                placeholder="search (e.g., milk, egg, fish,...)"
                placeholderTextColor="#999"
                value={allergyQuery}
                onChangeText={setAllergyQuery}
                onFocus={() => {
                  setIsDietFocused(false);
                  setIsAllergyFocused(true);
                }}
                style={styles.input}
              />
              {loadingAllergy && <ActivityIndicator style={styles.loader} size="small" color="#007AFF" />}

              {isAllergyFocused && allergyResults.length > 0 && (
                <View style={styles.dropdownContainer}>
                  {allergyResults.map((item) => (
                    <TouchableOpacity
                      key={String(item.tag_id)}
                      style={styles.dropdownItem}
                      onPress={() => handleSelectAllergy(item)}
                    >
                      <Text style={styles.dropdownItemText}>{item.tag_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Selected Chips (Allergies) */}
            <View style={styles.chipsContainer}>
              {selectedAllergies.length === 0 ? (
                <Text style={styles.noTagText}>No allergies selected</Text>
              ) : (
                selectedAllergies.map((tag) => (
                  <View key={String(tag.tag_id)} style={styles.chipAllergy}>
                    <Text style={styles.chipTextAllergy}>{tag.tag_name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveAllergy(tag.tag_id)}>
                      <Ionicons name="close-circle" size={18} color="#FF3B30" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* DIETARY */}
          <View style={[styles.sectionContainer, { zIndex: 10 }]}>
            <Text style={styles.label}>Dietary Preferences</Text>

            {/* Input & Dropdown */}
            <View style={styles.searchContainer}>
              <TextInput
                placeholder="search (e.g., Halal, Vegan, Non-Jae...)"
                placeholderTextColor="#999"
                value={dietQuery}
                onChangeText={setDietQuery}
                onFocus={() => {
                  setIsAllergyFocused(false);
                  setIsDietFocused(true);
                }}
                style={styles.input}
              />
              {loadingDiet && <ActivityIndicator style={styles.loader} size="small" color="#007AFF" />}

              {isDietFocused && dietResults.length > 0 && (
                <View style={styles.dropdownContainer}>
                  {dietResults.map((item) => (
                    <TouchableOpacity
                      key={String(item.tag_id)}
                      style={styles.dropdownItem}
                      onPress={() => handleSelectDiet(item)}
                    >
                      <Text style={styles.dropdownItemText}>{item.tag_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Selected Chips (Dietary) */}
            <View style={styles.chipsContainer}>
              {selectedDiets.length === 0 ? (
                <Text style={styles.noTagText}>No dietary preferences selected</Text>
              ) : (
                selectedDiets.map((tag) => (
                  <View key={String(tag.tag_id)} style={styles.chipDiet}>
                    <Text style={styles.chipTextDiet}>{tag.tag_name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveDiet(tag.tag_id)}>
                      <Ionicons name="close-circle" size={18} color="#FF9500" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>

        </ScrollView>

        {/* Submit Button */}
        <TouchableOpacity style={styles.button} onPress={handleNext} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Next</Text>}
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 24,
    paddingTop: 50,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1C1C1E" },
  sectionContainer: {
    marginBottom: 28,
    position: "relative",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  searchContainer: {
    position: "relative",
    width: "100%",
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    borderRadius: 10,
    fontSize: 15,
    color: "#333",
  },
  loader: { position: "absolute", right: 15, top: 15 },
  dropdownContainer: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    zIndex: 999,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  dropdownItemText: { fontSize: 15, color: "#333" },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  // Style ชิปฝั่ง แพ้อาหาร (สีฟ้า)
  chipAllergy: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E1F0FF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  chipTextAllergy: { color: "#007AFF", fontSize: 14, fontWeight: "500" },
  // Style ชิปฝั่ง รูปแบบการทาน (สีส้ม)
  chipDiet: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  chipTextDiet: { color: "#FF9500", fontSize: 14, fontWeight: "500" },
  noTagText: { color: "#999", fontSize: 13, fontStyle: "italic" },
  button: {
    backgroundColor: "#007AFF",
    width: "100%",
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});