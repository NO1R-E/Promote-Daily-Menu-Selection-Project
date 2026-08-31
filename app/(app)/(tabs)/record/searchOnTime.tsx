import { useEffect, useState, useCallback } from "react";
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

const PAGE_SIZE = 20; // กำหนดจำนวนการดึงข้อมูลทีละ 20 รายการ

export default function FoodSearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { meal_type, selected_date } = useLocalSearchParams<{ meal_type: string; selected_date: string }>();

  // State สำหรับเก็บข้อมูลและจัดการ Pagination
  const [recipes, setRecipes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ฟังก์ชันดึงข้อมูลแบบแบ่งหน้า (Pagination) + กรองคำค้นหา
  const fetchRecipesFromDB = async (queryText: string, pageIndex: number, isNewSearch = false) => {
    try {
      if (isNewSearch) {
        setIsLoadingRecipes(true);
      } else {
        setIsFetchingMore(true);
      }

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("v_recipes_with_calories")
        .select("recipe_id, recipe_name, img, total_calories")
        .range(from, to)
        .order("recipe_id", { ascending: true });

      // ถ้ามีการพิมพ์ค้นหา ให้ใช้ ilike เพื่อกรองข้อมูล
      if (queryText.trim() !== "") {
        query = query.ilike("recipe_name", `%${queryText.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // เช็กว่าข้อมูลหมดหรือยัง
        if (data.length < PAGE_SIZE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (isNewSearch) {
          setRecipes(data);
        } else {
          setRecipes((prev) => [...prev, ...data]);
        }
      }
    } catch (error: any) {
      console.error("Error fetching recipes:", error);
      Alert.alert("ข้อผิดพลาด", "ไม่สามารถโหลดข้อมูลคลังอาหารได้");
    } finally {
      setIsLoadingRecipes(false);
      setIsFetchingMore(false);
    }
  };

  // เรียกดึงข้อมูลใหม่ทุกครั้งที่ค้นหาคำใหม่
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchRecipesFromDB(searchQuery, 0, true);
  }, [searchQuery]);

  // ฟังก์ชันเรียกเมื่อผู้ใช้เลื่อนลงมาล่างสุด (Infinite Scroll)
  const handleLoadMore = () => {
    if (!isFetchingMore && !isLoadingRecipes && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchRecipesFromDB(searchQuery, nextPage, false);
    }
  };

  const handleSelectFood = async (recipeId: number, recipeName: string) => {
    if (!user) {
      Alert.alert("ข้อผิดพลาด", "ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }

    const targetDate = selected_date || new Date().toISOString().split("T")[0];

    try {
      setIsSubmitting(true);

      let { data: dailyRecord, error: fetchError } = await supabase
        .from("daily_record")
        .select("record_id")
        .eq("user_id", user.id)
        .eq("record_date", targetDate)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let currentRecordId = dailyRecord?.record_id;

      if (!dailyRecord) {
        const { data: newRecord, error: insertRecordError } = await supabase
          .from("daily_record")
          .insert({ user_id: user.id, record_date: targetDate })
          .select("record_id")
          .single();

        if (insertRecordError) throw insertRecordError;
        currentRecordId = newRecord.record_id;
      }

      const { error: insertItemError } = await supabase
        .from("record_item")
        .insert({
          record_id: currentRecordId,
          meal_type: meal_type,
          recipe_id: recipeId
        });

      if (insertItemError) throw insertItemError;

      Alert.alert("สำเร็จ", `บันทึก ${recipeName} ลงในมื้อ ${meal_type} เรียบร้อยแล้ว!`);
      router.back();

    } catch (error: any) {
      console.error("Error saving record:", error);
      Alert.alert("เกิดข้อผิดพลาด", error.message || "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select a menu at {meal_type}</Text>
      </View>

      {/* 1. เพิ่มกล่องค้นหา (Search Box) */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาชื่อเมนูอาหาร..."
          value={searchQuery}
          onChangeText={(text) => setSearchQuery(text)}
          returnKeyType="search"
        />
        {searchQuery !== "" && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* สภาพการโหลดแบบประมวลผลคำสั่งหรือเปิดครั้งแรก */}
      {isLoadingRecipes || isSubmitting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {isLoadingRecipes ? "กำลังค้นหาคลังอาหาร..." : "กำลังบันทึกข้อมูล..."}
          </Text>
        </View>
      ) : (
        /* 2. แสดงผลด้วย FlatList + Infinite Scroll ทีละ 20 */
        <FlatList
          data={recipes}
          keyExtractor={(item, index) => `${item.recipe_id}-${index}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.foodCard}
              onPress={() => handleSelectFood(item.recipe_id, item.recipe_name)}
            >
              <Image source={{ uri: item.img || "https://via.placeholder.com/150" }} style={styles.foodImage} />

              <View style={styles.foodInfo}>
                <Text style={styles.foodName}>{item.recipe_name}</Text>
                <Text style={styles.foodCal}>{item.total_calories} kcal</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          onEndReached={handleLoadMore} // เลื่อนล่างสุดดึงเพิ่ม
          onEndReachedThreshold={0.4} // สั่งโหลดเพิ่มเมื่อเลื่อนถึง 40% สุดท้าย
          ListFooterComponent={
            isFetchingMore ? (
              <View style={{ paddingVertical: 15 }}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isLoadingRecipes ? (
              <Text style={styles.emptyText}>ไม่พบรายการเมนูอาหาร</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", marginTop: 50, marginBottom: 15 },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A" },
  
  // Style กล่องค้นหา
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 15,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: "#1A1A1A" },

  foodCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F9FA", padding: 12, borderRadius: 16, marginBottom: 12 },
  foodImage: { width: 60, height: 60, borderRadius: 12, marginRight: 15 },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 16, fontWeight: "600", color: "#333" },
  foodCal: { fontSize: 14, color: "#666", marginTop: 4 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 14, color: "#666", fontWeight: "500" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#8E8E93", fontSize: 15 }
});