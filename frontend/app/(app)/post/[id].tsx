import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PostMenuSheet from "@/components/PostMenuSheet";
import RecordMealSheet from "@/components/RecordMealSheet";
import ReportModal from "@/components/ReportModal";
import {
  fetchForumPost,
  markForumDirty,
  reportPost,
  setLike,
  setSaved,
} from "@/src/api/forum";
import {
  fetchTodayLogs,
  logMeal,
  MEAL_LABEL,
  MealType,
  suggestMealType,
  TodayLog,
  undoLog,
} from "@/src/api/record";
import { fetchRecipeDetail, RecipeDetail } from "@/src/api/recipeDetail";
import { useAuth } from "@/src/contexts/AuthContext";
import { ForumPost } from "@/src/types/ForumType";
import { localDateString, timeAgo } from "@/src/utils/date";
import {
  confirmAdminDeletePost,
  confirmDeletePost,
  openEditPost,
} from "@/src/utils/postActions";

export default function PostScreen() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const [post, setPost] = useState<ForumPost | null>(null);
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const hasLoaded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const [todayLogs, setTodayLogs] = useState<TodayLog[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [recording, setRecording] = useState(false);

  // silent = refresh in place (no spinner), used when the screen regains focus after an edit
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const next = await fetchForumPost(postId, user?.id);
        setPost(next);
        if (!next) {
          setError("This post isn't available any more.");
          setDetail(null);
        } else {
          const rid = next.recipes?.recipe_id;
          if (rid != null) {
            try {
              setDetail(await fetchRecipeDetail(Number(rid)));
            } catch (err) {
              console.error("Loading recipe detail failed:", err);
              setDetail(null);
            }
          } else {
            setDetail(null);
          }
        }
        hasLoaded.current = true;
      } catch (err: any) {
        setError(err.message ?? "Couldn't load this post.");
      } finally {
        setLoading(false);
      }
    },
    [postId, user?.id],
  );

  // Runs on first open and every time we come back (e.g. after Edit -> Save)
  useFocusEffect(
    useCallback(() => {
      load(hasLoaded.current);
    }, [load]),
  );

  const refreshLogs = useCallback(async () => {
    if (!user?.id) {
      setTodayLogs([]);
      return;
    }
    try {
      setTodayLogs(await fetchTodayLogs(user.id, localDateString()));
    } catch (err) {
      console.error("Loading today's records failed:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/forum");
  };

  const toggleLike = async () => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to like posts.");
      return;
    }
    if (!post) return;
    const next = !post.is_liked;
    setPost({
      ...post,
      is_liked: next,
      likes_count: Math.max(0, post.likes_count + (next ? 1 : -1)),
    });
    try {
      await setLike(user.id, post.recipe_forum_id, next);
      markForumDirty();
    } catch (err) {
      console.error("Error updating like:", err);
      load();
    }
  };

  const toggleSave = async () => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to save posts.");
      return;
    }
    if (!post) return;
    const next = !post.is_saved;
    setPost({ ...post, is_saved: next });
    try {
      await setSaved(user.id, post.recipe_forum_id, next);
      markForumDirty();
    } catch (err) {
      console.error("Error updating save:", err);
      load();
    }
  };

  const submitReport = async (reason: string) => {
    if (!user || !post) {
      Alert.alert("Authentication Required", "Please log in to report a post.");
      return;
    }
    setSubmittingReport(true);
    try {
      await reportPost(user.id, post.recipe_forum_id, reason);
      Alert.alert(
        "Report Submitted",
        "Thank you for helping us keep the community safe.",
      );
      setReportVisible(false);
    } catch (err) {
      console.error("Error submitting report:", err);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const recipe = post?.recipes ?? null;
  const author = post?.profiles ?? null;
  const recipeId = recipe?.recipe_id ?? null;
  const isMine = !!user && !!post && post.user_id === user.id;
  const canManage = isMine || isAdmin; // admins get the three-dot menu on every post

  // tags grouped by their tag group, in the order recipeDetail returned them
  const tagGroups: { group: string; names: string[] }[] = [];
  (detail?.tags ?? []).forEach((t) => {
    const g = tagGroups.find((x) => x.group === t.group);
    if (g) g.names.push(t.name);
    else tagGroups.push({ group: t.group, names: [t.name] });
  });
  const nutrition = detail?.nutrition ?? null;
  const nutritionRows = nutrition
    ? [
        { label: "Calories", value: nutrition.calories, unit: "kcal" },
        { label: "Protein", value: nutrition.protein, unit: "g" },
        { label: "Carbs", value: nutrition.carbs, unit: "g" },
        { label: "Fat", value: nutrition.fat, unit: "g" },
        { label: "Fiber", value: nutrition.fiber, unit: "g" },
        { label: "Sugar", value: nutrition.sugar, unit: "g" },
        { label: "Sodium", value: nutrition.sodium, unit: "mg" },
      ]
    : [];

  // เมนูสามจุด: รอให้เมนูปิดก่อนค่อยเปิด Alert (iOS เปิดซ้อนกันทันทีไม่ได้)
  const menuEdit = () => {
    setMenuVisible(false);
    if (post) setTimeout(() => openEditPost(router, post.recipe_forum_id), 250);
  };

  const menuDelete = () => {
    setMenuVisible(false);
    if (!post) return;
    const forumId = post.recipe_forum_id;
    const confirm = isMine ? confirmDeletePost : confirmAdminDeletePost;
    setTimeout(
      () =>
        confirm(forumId, () => {
          markForumDirty();
          goBack();
        }),
      250,
    );
  };

  // วันนี้บันทึกสูตรนี้ไว้แล้วหรือยัง + มื้อไหนบ้างที่มีบันทึกวันนี้
  const myLog =
    recipeId !== null
      ? todayLogs.find((l) => Number(l.recipe_id) === Number(recipeId))
      : undefined;
  const loggedTypes = new Set(
    todayLogs.map((l) => l.meal_type).filter(Boolean) as string[],
  );

  // กด Ate it: ยังไม่บันทึกให้เปิดตัวเลือกมื้อ / บันทึกแล้วกดอีกครั้งเพื่อยกเลิก
  const onRecordPress = async () => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in to record meals.");
      return;
    }
    if (recipeId === null || recording) return;

    if (myLog) {
      setRecording(true);
      try {
        await undoLog(myLog.record_item_id);
        await refreshLogs();
      } catch (err: any) {
        Alert.alert("Couldn't undo", err.message);
      } finally {
        setRecording(false);
      }
      return;
    }
    setSheetVisible(true);
  };

  const onPickMealType = async (type: MealType) => {
    setSheetVisible(false);
    if (!user || recipeId === null) return;
    setRecording(true);
    try {
      await logMeal(user.id, Number(recipeId), type, localDateString());
      await refreshLogs();
    } catch (err: any) {
      Alert.alert("Couldn't record this meal", err.message);
    } finally {
      setRecording(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="#FF7A00" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipe</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF7A00" />
        </View>
      ) : error || !post || !recipe ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error ?? "This post isn't available any more."}
          </Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={styles.retry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailCard}>
            <View style={styles.authorRow}>
              <Image
                source={{
                  uri: author?.avatar_url || "https://picsum.photos/100",
                }}
                style={styles.avatar}
              />
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>
                  {author?.display_name || author?.username || "User"}
                </Text>
                <Text style={styles.timeAgo}>{timeAgo(post.created_at)}</Text>
                <View style={styles.tagsContainer}>
                  {post.hashtags.map((tag) => (
                    <View key={tag} style={styles.tagBadge}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.actionContainer}>
                <TouchableOpacity style={styles.statItem} onPress={toggleLike}>
                  <Text style={styles.statNumber}>{post.likes_count}</Text>
                  <Ionicons
                    name={post.is_liked ? "heart" : "heart-outline"}
                    size={22}
                    color={post.is_liked ? "#FF3B30" : "#333"}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={toggleSave}>
                  <Ionicons
                    name={post.is_saved ? "bookmark" : "bookmark-outline"}
                    size={21}
                    color={post.is_saved ? "#FF7A00" : "#666"}
                  />
                </TouchableOpacity>
                {canManage ? (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setMenuVisible(true)}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={21}
                      color="#666"
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setReportVisible(true)}
                  >
                    <Ionicons name="flag-outline" size={21} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {recipe.img?.[0] && (
              <Image source={{ uri: recipe.img[0] }} style={styles.mainImage} />
            )}

            <Text style={styles.mainTitle}>{post.title}</Text>
            <Text style={styles.subTitle}>
              {recipe.recipe_name}
              {recipe.serving ? ` · serves ${recipe.serving}` : ""}
            </Text>
            {!!detail?.cuisine.length && (
              <View style={styles.cuisineChip}>
                <Ionicons name="earth-outline" size={14} color="#C96A0A" />
                <Text style={styles.cuisineText}>
                  {detail.cuisine.map((c) => c.name).join(", ")}
                </Text>
              </View>
            )}
            {!!post.caption && (
              <Text style={styles.description}>{post.caption}</Text>
            )}

            {tagGroups.length > 0 && (
              <View style={styles.tagBlock}>
                {tagGroups.map((g) => (
                  <View key={g.group} style={styles.tagGroupRow}>
                    <Text style={styles.tagGroupLabel}>{g.group}</Text>
                    <View style={styles.tagGroupChips}>
                      {g.names.map((n) => (
                        <View key={n} style={styles.recipeTagChip}>
                          <Text style={styles.recipeTagText}>{n}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {nutrition && (
              <View style={styles.nutritionCard}>
                <Text style={styles.nutritionTitle}>Nutrition · per serving</Text>
                <View style={styles.nutritionGrid}>
                  {nutritionRows.map((r) => (
                    <View key={r.label} style={styles.nutritionCell}>
                      <Text style={styles.nutritionValue}>
                        {Math.round(r.value)}
                        <Text style={styles.nutritionUnit}> {r.unit}</Text>
                      </Text>
                      <Text style={styles.nutritionLabel}>{r.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.recordBtn, !!myLog && styles.recordBtnLogged]}
              onPress={onRecordPress}
              disabled={recording}
            >
              {recording ? (
                <ActivityIndicator color={myLog ? "#2E7D32" : "#FFFFFF"} />
              ) : myLog ? (
                <View style={styles.recordRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                  <Text style={styles.recordTextLogged}>
                    Logged
                    {myLog.meal_type ? ` · ${MEAL_LABEL[myLog.meal_type]}` : ""}
                    {"  "}(tap to undo)
                  </Text>
                </View>
              ) : (
                <View style={styles.recordRow}>
                  <Ionicons
                    name="restaurant-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.recordText}>Ate it</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.sectionHeader}>Ingredients</Text>
            {detail && detail.ingredients.length > 0 ? (
              detail.ingredients.map((ing, i) => (
                <Text key={i} style={styles.bodyText}>
                  • {ing.name}
                  {ing.weight_g ? ` — ${ing.weight_g}g` : ""}
                  {ing.isUser ? "  (custom)" : ""}
                </Text>
              ))
            ) : recipe.recipe_ingredients.length > 0 ? (
              recipe.recipe_ingredients.map((ri, i) => (
                <Text key={i} style={styles.bodyText}>
                  • {ri.ingredients?.norm_en ?? "Unknown ingredient"}
                  {ri.weight_g ? ` — ${ri.weight_g}g` : ""}
                </Text>
              ))
            ) : (
              <Text style={styles.bodyText}>No ingredients listed.</Text>
            )}

            <Text style={styles.sectionHeader}>Step-by-step</Text>
            {detail && detail.steps.length > 0 ? (
              detail.steps.map((s) => (
                <View key={s.step_no} style={styles.stepBlock}>
                  <Text style={styles.stepNo}>Step {s.step_no}</Text>
                  <Text style={styles.bodyText}>{s.description}</Text>
                  {s.img.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.stepImages}
                    >
                      {s.img.map((uri, k) => (
                        <Image
                          key={k}
                          source={{ uri }}
                          style={styles.stepImg}
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>
              ))
            ) : recipe.recipe_body ? (
              recipe.recipe_body
                .split("\n")
                .filter(Boolean)
                .map((step, i) => (
                  <Text key={i} style={styles.bodyText}>
                    {step}
                  </Text>
                ))
            ) : (
              <Text style={styles.bodyText}>No steps listed.</Text>
            )}

            {!!recipe.additional_info && (
              <>
                <Text style={styles.sectionHeader}>Additional Info</Text>
                <Text style={styles.bodyText}>{recipe.additional_info}</Text>
              </>
            )}
          </View>
        </ScrollView>
      )}

      <PostMenuSheet
        visible={menuVisible}
        onEdit={menuEdit}
        onDelete={menuDelete}
        onClose={() => setMenuVisible(false)}
        canEdit={isMine}
        deleteLabel={isMine ? "Delete post" : "Remove post (admin)"}
      />

      <RecordMealSheet
        visible={sheetVisible}
        suggested={suggestMealType(loggedTypes)}
        loggedTypes={loggedTypes}
        onPick={onPickMealType}
        onClose={() => setSheetVisible(false)}
      />

      <ReportModal
        visible={reportVisible}
        submitting={submittingReport}
        onClose={() => setReportVisible(false)}
        onSubmit={submitReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: { color: "#B00020", marginBottom: 12, textAlign: "center" },
  retry: { color: "#FF7A00", fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#FFF",
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#FF7A00" },
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
  avatar: { width: 44, height: 44, borderRadius: 22 },
  authorInfo: { flex: 1, marginLeft: 12 },
  authorName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  timeAgo: { fontSize: 12, color: "#999", marginTop: 2 },
  tagsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  tagBadge: {
    backgroundColor: "#EEEEEE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, color: "#666" },
  actionContainer: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statNumber: { fontSize: 13, color: "#333", fontWeight: "600" },
  iconBtn: { padding: 2 },
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

  recordBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#FF7A00",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  recordBtnLogged: {
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#2E7D32",
  },
  recordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recordText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  recordTextLogged: { color: "#2E7D32", fontWeight: "600", fontSize: 14 },

  sectionHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#000",
    marginTop: 8,
    marginBottom: 6,
  },
  bodyText: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 8 },
  cuisineChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#FFF5EA",
    borderWidth: 1,
    borderColor: "#F6C48F",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  cuisineText: { fontSize: 12, fontWeight: "600", color: "#C96A0A" },
  tagBlock: { marginBottom: 14, gap: 8 },
  tagGroupRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tagGroupLabel: { width: 82, fontSize: 12, fontWeight: "600", color: "#8E8E93", paddingTop: 5 },
  tagGroupChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  recipeTagChip: {
    backgroundColor: "#FFF5EA",
    borderWidth: 1,
    borderColor: "#F6C48F",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recipeTagText: { fontSize: 12, fontWeight: "600", color: "#C96A0A" },
  nutritionCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    padding: 12,
    marginBottom: 14,
  },
  nutritionTitle: { fontSize: 13, fontWeight: "700", color: "#333", marginBottom: 10 },
  nutritionGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  nutritionCell: { width: "25%", alignItems: "center" },
  nutritionValue: { fontSize: 16, fontWeight: "700", color: "#C96A0A" },
  nutritionUnit: { fontSize: 11, fontWeight: "500", color: "#8E8E93" },
  nutritionLabel: { fontSize: 11, color: "#666", marginTop: 2 },
  stepBlock: { marginBottom: 6 },
  stepNo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#C96A0A",
    marginBottom: 2,
  },
  stepImages: { gap: 8, paddingBottom: 8 },
  stepImg: { width: 140, height: 140, borderRadius: 10 },
});
