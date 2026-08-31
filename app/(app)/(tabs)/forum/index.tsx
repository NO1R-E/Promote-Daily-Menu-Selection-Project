import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";

export default function ForumIndex() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // State สำหรับจัดการ Modal รายละเอียด
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchRecipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recipe_forum")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setRecipes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  // ฟังก์ชันเปิด Modal พร้อมส่งข้อมูลสูตรอาหาร
  const handleOpenDetail = (item: any) => {
    setSelectedRecipe(item);
    setModalVisible(true);
  };

  // ฟังก์ชันปิด Modal
  const handleCloseDetail = () => {
    setModalVisible(false);
    setSelectedRecipe(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header - ปุ่ม Chat ชิดขวา */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.chatIconBtn} onPress={() => router.push("/(app)/(tabs)/forum/create-post")}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FF7A00" />
          <View style={styles.plusBadge}>
            <Text style={styles.plusBadgeText}>+</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.filterDropdown}>
          <Text style={styles.filterText}>All</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Recipe List (หน้า Feed) */}
      <FlatList
        data={recipes}
        keyExtractor={(item, index) => (item?.id ? item.id.toString() : index.toString())}
        onRefresh={fetchRecipes}
        refreshing={loading}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No recipes posted yet. Be the first!</Text>
        }
        renderItem={({ item }) => {
          const tags = item?.tags || ["chicken", "halal"];

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.card}
              onPress={() => handleOpenDetail(item)}
            >
              {/* Profile Bar */}
              <View style={styles.cardHeader}>
                <Image
                  source={{ uri: item.user_avatar || "https://picsum.photos/100" }}
                  style={styles.avatar}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.author_name || "Malee"}</Text>
                  <Text style={styles.timeAgo}>5 min ago</Text>
                </View>
                <TouchableOpacity style={{ padding: 4 }}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Cover Image */}
              <Image source={{ uri: item.img_url }} style={styles.cardImage} />

              {/* Title & Description */}
              <Text style={styles.cardTitle}>{item?.title || "How to make a French Onion Chicken"}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item?.description ||
                  "Lorem ipsum dolor sit amet, consectetur adipiscing elit..."}
              </Text>

              {/* Footer (Tags & Likes) */}
              <View style={styles.cardFooter}>
                <View style={styles.tagsContainer}>
                  {tags.map((tag: string, i: number) => (
                    <View key={i} style={styles.tagBadge}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.likeContainer}>
                  <Text style={styles.likeCount}>{item?.likes_count ?? 2056}</Text>
                  <Ionicons name="heart-outline" size={22} color="#333" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Modal หน้ารายละเอียด */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={handleCloseDetail}
      >
        <View style={styles.container}>
          {/* Header ด้านบนของ Modal - ใช้ปุ่ม Back (arrow-back) แทนขีด 3 ขีด */}
          <View style={styles.modalHeaderContainer}>
            <TouchableOpacity onPress={handleCloseDetail}>
              <Ionicons name="arrow-back" size={24} color="#FF7A00" />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Recipe</Text>
            
            <TouchableOpacity style={styles.chatIconBtn} onPress={() => {
              handleCloseDetail();
              router.push("/(app)/(tabs)/forum/create-post");
            }}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FF7A00" />
              <View style={styles.plusBadge}>
                <Text style={styles.plusBadgeText}>+</Text>
              </View>
            </TouchableOpacity>
          </View>

          {selectedRecipe && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Detail Card Box */}
              <View style={styles.detailCard}>
                {/* Profile & Stats Header */}
                <View style={styles.authorRow}>
                  <Image
                    source={{ uri: selectedRecipe.user_avatar || "https://picsum.photos/100" }}
                    style={styles.avatar}
                  />
                  <View style={styles.authorInfo}>
                    <Text style={styles.authorName}>{selectedRecipe.author_name || "Malee"}</Text>
                    <Text style={styles.timeAgo}>5 min ago</Text>

                    {/* Tags */}
                    <View style={styles.tagsContainer}>
                      {(selectedRecipe.tags || ["chicken", "halal"]).map((tag: string, i: number) => (
                        <View key={i} style={styles.tagBadge}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Icon Like & Utensils */}
                  <View style={styles.rightStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{selectedRecipe?.likes_count ?? 2056}</Text>
                      <Ionicons name="heart-outline" size={20} color="#333" />
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>256</Text>
                      <Ionicons name="restaurant-outline" size={18} color="#333" />
                    </View>
                  </View>
                </View>

                {/* Recipe Cover Image */}
                <Image source={{ uri: selectedRecipe.img_url }} style={styles.mainImage} />

                {/* Main Title */}
                <Text style={styles.mainTitle}>{selectedRecipe?.title || "French Onion Chicken"}</Text>

                {/* Sub Title & Description */}
                <Text style={styles.subTitle}>How to make a {selectedRecipe?.title || "French Onion Chicken"}</Text>
                <Text style={styles.description}>
                  {selectedRecipe?.description ||
                    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Consequat aliquet maecenas ut sit nulla"}
                </Text>

                {/* Ingredients Section */}
                <Text style={styles.sectionHeader}>Ingredients</Text>
                {Array.isArray(selectedRecipe?.ingredients_list) ? (
                  selectedRecipe.ingredients_list.map((ing: string, i: number) => (
                    <Text key={i} style={styles.bodyText}>
                      • {ing}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.bodyText}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Consequat aliquet maecenas ut sit nulla
                  </Text>
                )}

                {/* Step-by-step Section */}
                <Text style={styles.sectionHeader}>Step-by-step</Text>
                {Array.isArray(selectedRecipe?.recipe_steps) ? (
                  selectedRecipe.recipe_steps.map((step: string, i: number) => (
                    <Text key={i} style={styles.bodyText}>
                      {i + 1}. {step}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.bodyText}>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Consequat aliquet maecenas ut sit nulla
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#FFF",
  },
  modalHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#FFF",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#FF7A00" },
  chatIconBtn: { position: "relative" },
  plusBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    backgroundColor: "#FF7A00",
    borderRadius: 8,
    width: 12,
    height: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  plusBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "bold" },
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#333" },
  filterDropdown: { flexDirection: "row", alignItems: "center", gap: 4 },
  filterText: { fontSize: 14, color: "#666" },
  card: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  timeAgo: { fontSize: 12, color: "#999", marginTop: 2 },
  cardImage: { width: "100%", height: 180, borderRadius: 12, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#000", marginBottom: 6 },
  cardDesc: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 12 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tagsContainer: { flexDirection: "row", gap: 8, marginTop: 4 },
  tagBadge: { backgroundColor: "#EEEEEE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 12, color: "#666" },
  likeContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { fontSize: 14, color: "#333", fontWeight: "500" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#666" },

  /* Modal Specific Styles */
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 10 },
  detailCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  authorRow: { flexDirection: "row", marginBottom: 14 },
  authorInfo: { flex: 1, marginLeft: 12 },
  authorName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  rightStats: { alignItems: "flex-end", justifyContent: "space-between" },
  statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statNumber: { fontSize: 13, color: "#333", fontWeight: "600" },
  mainImage: { width: "100%", height: 200, borderRadius: 12, marginVertical: 12 },
  mainTitle: { fontSize: 18, fontWeight: "bold", color: "#000", marginBottom: 12 },
  subTitle: { fontSize: 15, fontWeight: "bold", color: "#000", marginBottom: 6 },
  description: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 16 },
  sectionHeader: { fontSize: 15, fontWeight: "bold", color: "#000", marginTop: 8, marginBottom: 6 },
  bodyText: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 8 },
});