import { useEffect, useState, useCallback } from "react";
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import { MEAL_TYPES, MEAL_LABEL, type MealType } from "@/src/api/record";

// recipes.img อาจเป็น array ของ URL (text[]) หรือ string ธรรมดา: หยิบรูปแรกที่ใช้ได้เสมอ
// (<Image uri> รับได้เฉพาะ string ถ้าส่ง array ไปจะเกิด error "cannot be cast from ReadableNativeArray to String")
const getFirstImage = (img: any): string | null => {
  let value = img;
  // กรณีเก็บเป็นสตริง JSON เช่น '["https://..."]'
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try { value = JSON.parse(value); } catch { /* ใช้ค่าเดิม */ }
  }
  if (Array.isArray(value)) {
    return value.find((u: any) => typeof u === "string" && u.length > 0) || null;
  }
  return typeof value === "string" && value.length > 0 ? value : null;
};

const PAGE_SIZE = 20;

export default function FoodSearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { meal_type, selected_date } = useLocalSearchParams<{ meal_type?: string; selected_date?: string }>();
  const initialMealType: MealType = MEAL_TYPES.includes((meal_type || "").toLowerCase() as MealType)
    ? (meal_type || "").toLowerCase() as MealType
    : "breakfast";
  const [selectedMealType, setSelectedMealType] = useState<MealType>(initialMealType);

  // state หลักของหน้านี้ - รายการเมนู, คำค้นหา, และ state ของ pagination
  const [recipes, setRecipes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ดึงเมนูทีละหน้า ถ้ามีคำค้นหาก็กรองไปด้วยเลย
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
        .from("recipes")
        .select("recipe_id, recipe_name, img, recipe_features(calories)")
        .range(from, to)
        .order("recipe_id", { ascending: true });

      // มีคำค้นหาค่อย filter ด้วย ilike ไม่งั้นดึงมาทั้งหมด
      if (queryText.trim() !== "") {
        query = query.ilike("recipe_name", `%${queryText.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // ดึงแคลอรี่จาก recipe_features มาใส่ total_calories (ถ้าสูตรไหนยังไม่มีข้อมูลจะเป็น 0)
        const rows = data.map((r: any) => {
          const f = Array.isArray(r.recipe_features) ? r.recipe_features[0] : r.recipe_features;
          return {
            recipe_id: r.recipe_id,
            recipe_name: r.recipe_name,
            img: getFirstImage(r.img),
            total_calories: Math.round(Number(f?.calories) || 0),
          };
        });

        // ได้น้อยกว่า PAGE_SIZE แปลว่าหมดแล้ว ไม่ต้องโหลดต่อ
        if (data.length < PAGE_SIZE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (isNewSearch) {
          setRecipes(rows);
        } else {
          setRecipes((prev) => [...prev, ...rows]);
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

  // พิมพ์คำค้นหาใหม่ทีไร รีเซ็ต page แล้วดึงใหม่ตั้งแต่หน้าแรก
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchRecipesFromDB(searchQuery, 0, true);
  }, [searchQuery]);

  // เลื่อนใกล้ล่างสุดแล้วค่อยโหลดหน้าถัดไป
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

    // insert ลง record_item ทีเดียวจบ ไม่ต้องเช็คว่ามีแถวเดิมอยู่ก่อนไหม
    const { error: insertItemError } = await supabase
      .from("record_item")
      .insert({
        user_id: user.id,            // ID ผู้ใช้งาน
        record_date: targetDate,     // วันที่บันทึก
        meal_type: selectedMealType, // breakfast | lunch | dinner | snack
        recipe_id: recipeId          // ID เมนูอาหาร
      });

    if (insertItemError) throw insertItemError;

    Alert.alert("สำเร็จ", `บันทึก ${recipeName} ลงใน ${MEAL_LABEL[selectedMealType]} เรียบร้อยแล้ว!`);
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
        <Text style={styles.headerTitle}>Select a menu</Text>
      </View>

      {/* เลือกประเภทมื้ออาหาร: เลือกซ้ำได้เพื่อเพิ่มหลายเมนูในมื้อเดียวกัน */}
      <Text style={styles.mealTypeHeading}>Record meal at</Text>
      <View style={styles.mealTypeContainer}>
        {MEAL_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.mealTypeButton, selectedMealType === type && styles.mealTypeButtonSelected]}
            onPress={() => setSelectedMealType(type)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedMealType === type }}
          >
            <Text style={[styles.mealTypeText, selectedMealType === type && styles.mealTypeTextSelected]}>
              {MEAL_LABEL[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* กล่องค้นหาเมนู */}
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

      {/* กำลังโหลดครั้งแรก หรือกำลังบันทึกอยู่ ก็โชว์ spinner แทน list ไปก่อน */}
      {isLoadingRecipes || isSubmitting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {isLoadingRecipes ? "กำลังค้นหาคลังอาหาร..." : "กำลังบันทึกข้อมูล..."}
          </Text>
        </View>
      ) : (
        /* list เมนู โหลดเพิ่มทีละ 20 ตอนเลื่อนถึงล่าง */
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
  
  mealTypeHeading: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 },
  mealTypeContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 15 },
  mealTypeButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "#E0E0E0", backgroundColor: "#F8F9FA" },
  mealTypeButtonSelected: { backgroundColor: "#F28E2B", borderColor: "#F28E2B" },
  mealTypeText: { fontSize: 13, fontWeight: "600", color: "#555" },
  mealTypeTextSelected: { color: "#FFFFFF" },

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
