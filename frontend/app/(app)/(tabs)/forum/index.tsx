import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import ReportModal from "@/components/ReportModal";
import {
  consumeForumDirty,
  forumSelect,
  normalizePost,
  reportPost,
  searchForumIds,
  setLike,
  setSaved,
} from "@/src/api/forum";
import { ForumPost } from "@/src/types/ForumType";
import { timeAgo } from "@/src/utils/date";

type Tab = "hot" | "recent" | "saved";

const PAGE_SIZE = 5;

// ตัดช่องว่างและ # นำหน้าออก (แฮชแท็กในฐานข้อมูลเก็บแบบไม่มี #)
const normalizeQuery = (s: string) => s.trim().replace(/^#+/, "").trim();

export default function ForumIndex() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("hot");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [booted, setBooted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const searchIdsRef = useRef<number[] | null>(null);
  const requestRef = useRef(0);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<number | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  // ผู้ใช้หยุดพิมพ์ 350 ms ค่อยค้นหา
  useEffect(() => {
    const t = setTimeout(
      () => setActiveQuery(normalizeQuery(searchQuery)),
      350,
    );
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchPage = async (reset: boolean) => {
    if (reset) {
      setLoading(true);
      setLoadError(false);
    } else {
      if (!hasMore || loadingMore || loading || posts.length === 0) return;
      setLoadingMore(true);
    }

    // ตัวนับคำขอ: ถ้ามีคำขอใหม่กว่าเริ่มแล้ว ผลของคำขอเก่าจะถูกทิ้ง
    const reqId = reset ? ++requestRef.current : requestRef.current;
    const list = reset ? [] : posts;
    const last = list.length ? list[list.length - 1] : null;

    try {
      // ค้นหาจาก Supabase: ได้ id ของโพสต์ที่ตรง (ชื่อโพสต์ / ชื่อสูตร / แฮชแท็ก)
      let ids: number[] | null = null;
      if (activeQuery) {
        if (reset) {
          ids = await searchForumIds(activeQuery);
          searchIdsRef.current = ids;
        } else {
          ids = searchIdsRef.current;
        }
        if (reqId !== requestRef.current) return;
        if (!ids || ids.length === 0) {
          setPosts([]);
          setHasMore(false);
          return;
        }
      } else if (reset) {
        searchIdsRef.current = null;
      }

      if (tab === "saved" && !user) {
        setPosts([]);
        setHasMore(false);
        return;
      }

      let q = supabase
        .from("recipe_forum")
        .select(forumSelect(user?.id))
        .eq("is_hidden", false)
        .limit(PAGE_SIZE);

      if (user) {
        q = q.eq("recipe_forum_likes.user_id", user.id);
        q = q.eq("recipe_forum_saved.user_id", user.id);
      }
      if (ids) q = q.in("recipe_forum_id", ids);

      if (tab === "saved") {
        q = q.not("recipe_forum_saved", "is", null);
        q = q.order("recipe_forum_id", { ascending: false });
        if (!reset && last) q = q.lt("recipe_forum_id", last.recipe_forum_id);
      } else if (tab === "hot") {
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
      if (reqId !== requestRef.current) return;
      if (error) throw error;

      const page = (data ?? [])
        .filter((p: any) => p.recipes !== null)
        .map((p: any) => normalizePost(p, user?.id)) as ForumPost[];

      setPosts(reset ? page : [...list, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      if (reqId !== requestRef.current) return;
      console.error("Error loading forum feed:", err);
      setLoadError(true);
    } finally {
      if (reqId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setBooted(true);
      }
    }
  };

  useEffect(() => {
    fetchPage(true);
  }, [tab, activeQuery]);

  useFocusEffect(
    useCallback(() => {
      if (consumeForumDirty()) fetchPage(true);
    }, [tab, activeQuery, user?.id]),
  );

  const onPullRefresh = async () => {
    setPulling(true);
    await fetchPage(true);
    setPulling(false);
  };

  const handleToggleLike = async (forumId: number) => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to like posts.");
      return;
    }
    const target = posts.find((p) => p.recipe_forum_id === forumId);
    if (!target) return;
    const next = !(target.is_liked ?? false);

    setPosts((prev) =>
      prev.map((p) =>
        p.recipe_forum_id === forumId
          ? {
              ...p,
              is_liked: next,
              likes_count: next
                ? p.likes_count + 1
                : Math.max(0, p.likes_count - 1),
            }
          : p,
      ),
    );

    try {
      await setLike(user.id, forumId, next);
    } catch (err) {
      console.error("Error updating like:", err);
      fetchPage(true);
    }
  };

  const handleToggleSave = async (forumId: number) => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to save posts.");
      return;
    }
    const target = posts.find((p) => p.recipe_forum_id === forumId);
    if (!target) return;
    const next = !(target.is_saved ?? false);

    setPosts((prev) =>
      prev.map((p) =>
        p.recipe_forum_id === forumId ? { ...p, is_saved: next } : p,
      ),
    );

    try {
      await setSaved(user.id, forumId, next);
      if (!next && tab === "saved") {
        setPosts((prev) => prev.filter((p) => p.recipe_forum_id !== forumId));
      }
    } catch (err) {
      console.error("Error updating save:", err);
      fetchPage(true);
    }
  };

  const handleOpenReport = (forumId: number) => {
    setReportingPostId(forumId);
    setReportModalVisible(true);
  };

  const handleReportSubmit = async (reason: string) => {
    if (!user || reportingPostId === null) {
      Alert.alert("Authentication Required", "Please log in to report a post.");
      return;
    }
    setSubmittingReport(true);
    try {
      await reportPost(user.id, reportingPostId, reason);
      Alert.alert(
        "Report Submitted",
        "Thank you for helping us keep the community safe.",
      );
      setReportModalVisible(false);
      setReportingPostId(null);
    } catch (err) {
      console.error("Error submitting report:", err);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  // เต็มจอเฉพาะโหลดครั้งแรก ครั้งต่อไป (ค้นหา/เปลี่ยนแท็บ) ช่องค้นหาต้องอยู่เหมือนเดิม
  if (!booted) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.tabRow}>
          {(["hot", "recent", "saved"] as const).map((tabKey) => {
            const isActive = tab === tabKey;
            return (
              <TouchableOpacity
                key={tabKey}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setTab(tabKey)}
              >
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                >
                  {tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.chatIconBtn}
          onPress={() => router.push("/(app)/(tabs)/forum/create-post")}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={29}
            color="#FF7A00"
          />
          <View style={styles.plusBadge}>
            <Text style={styles.plusBadgeText}>+</Text>
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.recipe_forum_id.toString()}
        onRefresh={onPullRefresh}
        refreshing={pulling}
        keyboardShouldPersistTaps="handled"
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
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#FF7A00" />
          ) : loadError ? (
            <View style={styles.errorBox}>
              <Text style={{ color: "#B00020", marginBottom: 12 }}>
                Couldn't load the feed.
              </Text>
              <TouchableOpacity onPress={() => fetchPage(true)}>
                <Text style={{ color: "#FF7A00", fontWeight: "600" }}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {activeQuery
                ? `No recipes match "${activeQuery}".`
                : tab === "saved"
                  ? "No saved posts yet."
                  : "No recipes posted yet. Be the first!"}
            </Text>
          )
        }
        ListHeaderComponent={
          <View style={styles.searchSection}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#999"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search title, recipe or #tag"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {loading && posts.length > 0 ? (
              <ActivityIndicator size="small" color="#FF7A00" />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#BBB" />
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const recipe = item.recipes!;
          const author = item.profiles;
          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.card}
              onPress={() =>
                router.push(`/(app)/post/${item.recipe_forum_id}` as any)
              }
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
                    onPress={() => handleToggleSave(item.recipe_forum_id)}
                    style={styles.reportBtn}
                  >
                    <Ionicons
                      name={item.is_saved ? "bookmark" : "bookmark-outline"}
                      size={20}
                      color={item.is_saved ? "#FF7A00" : "#666"}
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
  container: { flex: 1, backgroundColor: "#FFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorBox: { alignItems: "center", marginTop: 40 },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: "#FFF",
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
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
});
