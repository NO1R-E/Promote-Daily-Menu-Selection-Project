import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

export default function PreferenceScreen() {
  const router = useRouter();
  const { refreshUserData } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ tag_id: any; tag_name: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<{ tag_id: any; tag_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. โหลดข้อมูล tags เดิมของผู้ใช้นี้มาแสดง (ถ้ามี)
  useEffect(() => {
    const fetchExistingPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Query ดึง user_pref พร้อม join เอา tag_name จากตาราง tags
        const { data, error } = await supabase
          .from("user_pref")
          .select("tag_id, tags(tag_name)")
          .eq("user_id", user.id);

        if (error) throw error;

        if (data && data.length > 0) {
          const formattedTags = data.map((item: any) => ({
            tag_id: item.tag_id,
            tag_name: item.tags?.tag_name || "",
          }));
          setSelectedTags(formattedTags);
        }
      } catch (err) {
        console.error("Error loading existing preferences:", err);
      }
    };

    fetchExistingPreferences();
  }, []);

  // ค้นหา tag_name จาก Supabase เมื่อ searchQuery เปลี่ยนแปลง
  useEffect(() => {
    const fetchTags = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("tags")
          .select("tag_id, tag_name")
          .ilike("tag_name", `%${searchQuery}%`) // ค้นหาเฉพาะ tag_name ที่คล้ายคำค้นหา
          .limit(10);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error("Error fetching tags:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchTags, 300); // Debounce ป้องกันการยิง query ถี่เกินไป
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // เลือก Tag
  const handleSelectTag = (tag: { tag_id: any; tag_name: string }) => {
    if (!selectedTags.some((t) => t.tag_id === tag.tag_id)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  // เอา Tag ออก
  const handleRemoveTag = (tagId: any) => {
    setSelectedTags(selectedTags.filter((t) => t.tag_id !== tagId));
  };

  // 3. บันทึกข้อมูลลงตาราง user_pref แล้วอัปเดตสถานะ AuthContext ก่อนเปลี่ยนหน้า
  const handleSubmit = async () => {
    // 💡 เช็กเงื่อนไขห้ามว่าง: ถ้าไม่ได้เลือก Tag เลยให้แสดง Alert แจ้งเตือนแล้วหยุดทำงาน
    if (selectedTags.length === 0) {
      Alert.alert("Validation Error", "Please select at least one preference.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      // ลบข้อมูลเดิมในตาราง user_pref ของ user คนนี้ออกก่อน (กรณีกลับมาแก้ไข/เลือกใหม่)
      const { error: deleteError } = await supabase
        .from("user_pref")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      // Insert ชุดข้อมูลใหม่ลงไป
      const recordsToInsert = selectedTags.map((tag) => ({
        user_id: user.id,
        tag_id: tag.tag_id,
      }));

      const { error: insertError } = await supabase
        .from("user_pref")
        .insert(recordsToInsert);

      if (insertError) throw insertError;

      // อัปเดตข้อมูลผู้ใช้ใน AuthContext ทันที
      await refreshUserData();

      // ไปยังหน้าหลักเมื่อบันทึกและอัปเดต State เรียบร้อยแล้ว
      router.replace("/(app)/(tabs)/chatbot");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Allergies Data</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.label}>Search Allergies</Text>
      
      {/* Input Search */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search allergies"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          style={styles.input}
        />
        {loading && <ActivityIndicator style={styles.loader} size="small" color="#007AFF" />}
      </View>

      {/* Search Result Dropdown List */}
      {searchResults.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.tag_id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => handleSelectTag(item)}
              >
                <Text style={styles.dropdownItemText}>{item.tag_name}</Text>
              </TouchableOpacity>
            )}
            nestedScrollEnabled
          />
        </View>
      )}

      {/* Selected Tags Display (Chips) */}
      <View style={styles.chipsContainer}>
        {selectedTags.map((tag) => (
          <View key={String(tag.tag_id)} style={styles.chip}>
            <Text style={styles.chipText}>{tag.tag_name}</Text>
            <TouchableOpacity onPress={() => handleRemoveTag(tag.tag_id)}>
              <Ionicons name="close-circle" size={18} color="#FF3B30" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* ปุ่มกด Submit พร้อม Indicator ตอนบันทึก */}
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Submit</Text>
        )}
      </TouchableOpacity>
    </View>
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A4A4A",
    marginBottom: 6,
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
    fontSize: 16,
    color: "#333",
  },
  loader: {
    position: "absolute",
    right: 15,
    top: 15,
  },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    maxHeight: 180,
    marginTop: 4,
    elevation: 5,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 15,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E1F0FF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  chipText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#007AFF",
    width: "100%",
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 20,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
