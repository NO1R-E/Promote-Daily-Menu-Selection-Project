// app/(app)/(tabs)/forum/index.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import ReportModal from "@/components/ReportModal";

type Tab = "hot" | "recent";

type ForumPost = {
  recipe_forum_id: number;
  title: string;
  caption: string | null;
  hashtags: string[];
  likes_count: number;
  created_at: string;
  feed_score: number;
  is_liked?: boolean;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  recipes: {
    recipe_id: number;
    recipe_name: string | null;
    serving: number | null;
    img: string[];
    recipe_body: string | null;
    additional_info: string | null;
    status: string;
    recipe_ingredients: {
      weight_g: number | null;
      ingredients: { ingredient_id: number; norm_en: string } | null;
    }[];
  } | null;
};

const PAGE_SIZE = 5;

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ForumIndex() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("hot");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // State for Report Modal
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<number | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  const selectColumns = `
    recipe_forum_id, title, caption, hashtags, likes_count, created_at, feed_score,
    profiles ( username, display_name, avatar_url ),
    recipes (
      recipe_id, recipe_name, serving, img, recipe_body, additional_info, status,
      recipe_ingredients ( weight_g, ingredients ( ingredient_id, norm_en ) )
    )
    ${user ? `, recipe_forum_likes!left ( user_id )` : ""}
  `;

  const fetchPage = async (reset: boolean) => {
    if (reset) {
      setLoading(true);
      setLoadError(false);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }

    const list = reset ? [] : posts;
    const last = list.length ? list[list.length - 1] : null;

    let q = supabase
      .from("recipe_forum")
      .select(selectColumns)
      .eq("is_hidden", false)
      .limit(PAGE_SIZE);

    if (user) {
      q = q.eq("recipe_forum_likes.user_id", user.id);
    }

    if (tab === "hot") {
      q = q
        .order("feed_score", { ascending: false })
        .order("recipe_forum_id", { ascending: true });
      if (!reset && last) {
        q = q.or(
          `feed_score.lt.${last.feed_score},and(feed_score.eq.${last.feed_score},recipe_forum_id.gt.${last.recipe_forum_id})`,
        );
      }
    } else {
      q = q.order("recipe_forum_id", { ascending: false });
      if (!reset && last) q = q.lt("recipe_forum_id", last.recipe_forum_id);
    }

    const { data, error } = await q;

    if (error) {
      console.error("Error loading forum feed:", error);
      setLoadError(true);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const page = (data ?? [])
      .filter((p: any) => p.recipes !== null)
      .map((p: any) => ({
        ...p,
        is_liked: user
          ? Array.isArray(p.recipe_forum_likes) &&
            p.recipe_forum_likes.length > 0
          : false,
      })) as ForumPost[];

    setPosts(reset ? page : [...list, ...page]);
    setHasMore(page.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchPage(true);
  }, [tab]);

  const visiblePosts = searchQuery.trim()
    ? posts.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      )
    : posts;

  const handleToggleLike = async (forumId: number) => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to like posts.");
      return;
    }

    const targetPost = posts.find((p) => p.recipe_forum_id === forumId);
    if (!targetPost) return;

    const currentlyLiked = targetPost.is_liked ?? false;

    // 1. Optimistic Update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.recipe_forum_id === forumId) {
          const nextLiked = !currentlyLiked;
          return {
            ...p,
            is_liked: nextLiked,
            likes_count: nextLiked
              ? p.likes_count + 1
              : Math.max(0, p.likes_count - 1),
          };
        }
        return p;
      }),
    );

    if (selectedPost && selectedPost.recipe_forum_id === forumId) {
      const nextLiked = !currentlyLiked;
      setSelectedPost((prev) =>
        prev
          ? {
              ...prev,
              is_liked: nextLiked,
              likes_count: nextLiked
                ? prev.likes_count + 1
                : Math.max(0, prev.likes_count - 1),
            }
          : null,
      );
    }

    // 2. Database Sync
    if (currentlyLiked) {
      const { error } = await supabase
        .from("recipe_forum_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("forum_id", forumId);

      if (error) {
        console.error("Error unliking post:", error);
        // Rollback on error
        fetchPage(true);
      }
    } else {
      const { error } = await supabase
        .from("recipe_forum_likes")
        .insert({ user_id: user.id, forum_id: forumId });

      if (error) {
        console.error("Error liking post:", error);
        // Rollback on error
        fetchPage(true);
      }
    }
  };

  const handleOpenDetail = (item: ForumPost) => {
    setSelectedPost(item);
    setModalVisible(true);
  };
  const handleCloseDetail = () => {
    setModalVisible(false);
    setSelectedPost(null);
  };

  const handleOpenReport = (forumId: number) => {
    setReportingPostId(forumId);
    setReportModalVisible(true);
  };

  const handleReportSubmit = async (reason: string) => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to report a post.");
      return;
    }

    setSubmittingReport(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      forum_id: reportingPostId,
      reason,
    });
    setSubmittingReport(false);

    if (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } else {
      Alert.alert(
        "Report Submitted",
        "Thank you for helping us keep the community safe.",
      );
      setReportModalVisible(false);
      setReportingPostId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#B00020", marginBottom: 12 }}>
          Couldn't load the feed.
        </Text>
        <TouchableOpacity onPress={() => fetchPage(true)}>
          <Text style={{ color: "#FF7A00", fontWeight: "600" }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.chatIconBtn}
          onPress={() => router.push("/(app)/(tabs)/forum/create-post")}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={22}
            color="#FF7A00"
          />
          <View style={styles.plusBadge}>
            <Text style={styles.plusBadgeText}>+</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "hot" && styles.tabBtnActive]}
          onPress={() => setTab("hot")}
        >
          <Text style={[styles.tabText, tab === "hot" && styles.tabTextActive]}>
            Hot
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "recent" && styles.tabBtnActive]}
          onPress={() => setTab("recent")}
        >
          <Text
            style={[styles.tabText, tab === "recent" && styles.tabTextActive]}
          >
            Recent
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#999"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.recipe_forum_id.toString()}
        onRefresh={() => fetchPage(true)}
        refreshing={loading}
        onEndReachedThreshold={0.4}
        onEndReached={() => fetchPage(false)}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 16 }} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No recipes posted yet. Be the first!
          </Text>
        }
        renderItem={({ item }) => {
          const recipe = item.recipes!;
          const author = item.profiles;
          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.card}
              onPress={() => handleOpenDetail(item)}
            >
              <View style={styles.cardHeader}>
                <Image
                  source={{
                    uri: author?.avatar_url || "https://picsum.photos/100",
                  }}
                  style={styles.avatar}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {author?.display_name || author?.username || "User"}
                  </Text>
                  <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
                </View>
              </View>

              {recipe.img?.[0] && (
                <Image
                  source={{ uri: recipe.img[0] }}
                  style={styles.cardImage}
                />
              )}

              <Text style={styles.cardTitle}>{item.title}</Text>
              {!!item.caption && (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.caption}
                </Text>
              )}

              <View style={styles.cardFooter}>
                <View style={styles.tagsContainer}>
                  {item.hashtags.slice(0, 3).map((tag) => (
                    <View key={tag} style={styles.tagBadge}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.actionContainer}>
                  <TouchableOpacity
                    style={styles.likeContainer}
                    onPress={() => handleToggleLike(item.recipe_forum_id)}
                  >
                    <Text style={styles.likeCount}>{item.likes_count}</Text>
                    <Ionicons
                      name={item.is_liked ? "heart" : "heart-outline"}
                      size={22}
                      color={item.is_liked ? "#FF3B30" : "#333"}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleOpenReport(item.recipe_forum_id)}
                    style={styles.reportBtn}
                  >
                    <Ionicons name="flag-outline" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={handleCloseDetail}
      >
        <View style={styles.container}>
          <View style={styles.modalHeaderContainer}>
            <TouchableOpacity onPress={handleCloseDetail}>
              <Ionicons name="arrow-back" size={24} color="#FF7A00" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Recipe</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedPost?.recipes && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailCard}>
                <View style={styles.authorRow}>
                  <Image
                    source={{
                      uri:
                        selectedPost.profiles?.avatar_url ||
                        "https://picsum.photos/100",
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.authorInfo}>
                    <Text style={styles.authorName}>
                      {selectedPost.profiles?.display_name ||
                        selectedPost.profiles?.username ||
                        "User"}
                    </Text>
                    <Text style={styles.timeAgo}>
                      {timeAgo(selectedPost.created_at)}
                    </Text>
                    <View style={styles.tagsContainer}>
                      {selectedPost.hashtags.map((tag) => (
                        <View key={tag} style={styles.tagBadge}>
                          <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.rightStats}>
                    <View style={styles.actionContainer}>
                      <TouchableOpacity
                        style={styles.statItem}
                        onPress={() =>
                          handleToggleLike(selectedPost.recipe_forum_id)
                        }
                      >
                        <Text style={styles.statNumber}>
                          {selectedPost.likes_count}
                        </Text>
                        <Ionicons
                          name={
                            selectedPost.is_liked ? "heart" : "heart-outline"
                          }
                          size={20}
                          color={selectedPost.is_liked ? "#FF3B30" : "#333"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          handleOpenReport(selectedPost.recipe_forum_id)
                        }
                        style={styles.reportBtn}
                      >
                        <Ionicons name="flag-outline" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {selectedPost.recipes.img?.[0] && (
                  <Image
                    source={{ uri: selectedPost.recipes.img[0] }}
                    style={styles.mainImage}
                  />
                )}

                <Text style={styles.mainTitle}>{selectedPost.title}</Text>
                <Text style={styles.subTitle}>
                  {selectedPost.recipes.recipe_name}
                  {selectedPost.recipes.serving
                    ? ` · serves ${selectedPost.recipes.serving}`
                    : ""}
                </Text>
                {!!selectedPost.caption && (
                  <Text style={styles.description}>{selectedPost.caption}</Text>
                )}

                <Text style={styles.sectionHeader}>Ingredients</Text>
                {selectedPost.recipes.recipe_ingredients.length > 0 ? (
                  selectedPost.recipes.recipe_ingredients.map((ri, i) => (
                    <Text key={i} style={styles.bodyText}>
                      • {ri.ingredients?.norm_en ?? "Unknown ingredient"}
                      {ri.weight_g ? ` — ${ri.weight_g}g` : ""}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.bodyText}>No ingredients listed.</Text>
                )}

                <Text style={styles.sectionHeader}>Step-by-step</Text>
                {selectedPost.recipes.recipe_body ? (
                  selectedPost.recipes.recipe_body
                    .split("\n")
                    .filter(Boolean)
                    .map((step, i) => (
                      <Text key={i} style={styles.bodyText}>
                        {i + 1}. {step}
                      </Text>
                    ))
                ) : (
                  <Text style={styles.bodyText}>No steps listed.</Text>
                )}

                {!!selectedPost.recipes.additional_info && (
                  <>
                    <Text style={styles.sectionHeader}>Additional Info</Text>
                    <Text style={styles.bodyText}>
                      {selectedPost.recipes.additional_info}
                    </Text>
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      <ReportModal
        visible={reportModalVisible}
        submitting={submittingReport}
        onClose={() => {
          setReportModalVisible(false);
          setReportingPostId(null);
        }}
        onSubmit={handleReportSubmit}
      />
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
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: "#FFF",
    paddingBottom: 10,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  tabBtnActive: { backgroundColor: "#FF7A00" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#666" },
  tabTextActive: { color: "#FFF" },
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
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 6,
  },
  cardDesc: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 12 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tagsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
    flex: 1,
  },
  tagBadge: {
    backgroundColor: "#EEEEEE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, color: "#666" },
  actionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  likeContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { fontSize: 14, color: "#333", fontWeight: "500" },
  reportBtn: { padding: 2 },
  emptyText: { textAlign: "center", marginTop: 40, color: "#666" },
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
  mainImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginVertical: 12,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#000",
    marginTop: 8,
    marginBottom: 6,
  },
  bodyText: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 8 },
});
