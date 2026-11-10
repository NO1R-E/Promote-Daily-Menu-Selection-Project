import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/src/config/supabase";

type FlaggedForum = {
  recipe_forum_id: number;
  title: string;
  caption: string | null;
  created_at: string;
  poster_id: string;
  unique_reporter_count: number;
  total_reports: number;
  combined_reasons: string;
};

type FullForumDetail = {
  recipe_forum_id: number;
  title: string;
  caption: string | null;
  created_at: string;
  user_id: string;
  recipes: { recipe_name: string | null; recipe_body: string | null } | null;
  profiles: { username: string; display_name: string | null } | null;
};

const BAN_DURATIONS: { label: string; days: number | null }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Permanent", days: null },
];

export default function AdminReportsScreen() {
  const router = useRouter();
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedForum[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPost, setSelectedPost] = useState<FullForumDetail | null>(
    null,
  );
  const [selectedReportSummary, setSelectedReportSummary] =
    useState<FlaggedForum | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [banDays, setBanDays] = useState<number | null>(7);

  const fetchFlaggedReports = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_flagged_forums");
    if (error) {
      console.error("Error fetching flagged forums via RPC:", error);
      Alert.alert("Error", "Could not fetch report queue.");
    } else {
      setFlaggedPosts(data || []);
    }
    setLoading(false);
  };

  // refetch every time the screen regains focus, so a post removed in the forum drops off the queue
  useFocusEffect(
    useCallback(() => {
    fetchFlaggedReports();
    }, []),
  );

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyText = async (key: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };

  const openPostInForum = () => {
    if (!selectedPost) return;
    const id = selectedPost.recipe_forum_id;
    setReviewModalVisible(false);
    router.push(`/post/${id}`);
  };

  const handleOpenReview = async (item: FlaggedForum) => {
    setSelectedReportSummary(item);
    setBanDays(7);

    const { data, error } = await supabase
      .from("recipe_forum")
      .select(
        `
        recipe_forum_id, title, caption, created_at, user_id,
        profiles ( username, display_name ),
        recipes ( recipe_name, recipe_body )
      `,
      )
      .eq("recipe_forum_id", item.recipe_forum_id)
      .single();

    if (error || !data) {
      Alert.alert("Error", "Could not load forum details.");
      return;
    }
    setSelectedPost(data as unknown as FullForumDetail);
    setReviewModalVisible(true);
  };

  // every decision is irreversible (reports get closed, posts get removed, users get banned): ask first
  const confirmDecision = (isFault: boolean, banPoster: boolean) => {
    const banText = banDays === null ? "permanently" : `for ${banDays} days`;
    const cfg = !isFault
      ? {
          title: "Dismiss these reports?",
          body: "The post stays visible and all pending reports on it are closed as no fault.",
          ok: "Dismiss",
        }
      : !banPoster
        ? {
            title: "Delete this post?",
            body: "The post is removed from the forum and from meal recommendations, and the reports are closed. This can't be undone.",
            ok: "Delete post",
          }
        : {
            title: `Delete post and ban poster ${banText}?`,
            body: `The post is removed and the poster is banned ${banText}. This can't be undone.`,
            ok: "Delete & ban",
          };
    Alert.alert(cfg.title, cfg.body, [
      { text: "Cancel", style: "cancel" },
      {
        text: cfg.ok,
        style: isFault ? "destructive" : "default",
        onPress: () => handleReviewDecision(isFault, banPoster),
      },
    ]);
  };

  // All writes happen server-side in one admin-checked transaction
  const handleReviewDecision = async (isFault: boolean, banPoster: boolean) => {
    if (!selectedPost) return;
    setSubmittingAction(true);
    try {
      const { error } = await supabase.rpc("admin_review_report", {
        p_forum_id: selectedPost.recipe_forum_id,
        p_at_fault: isFault,
        p_ban: banPoster,
        p_ban_days: banPoster ? banDays : null,
        p_reason: `Violated community guidelines (post: ${selectedPost.title})`,
      });
      if (error) throw error;

      Alert.alert("Success", "Review completed.");
      setReviewModalVisible(false);
      fetchFlaggedReports();
    } catch (err: any) {
      console.error("Error applying review decision:", err);
      Alert.alert(
        "Error",
        err?.message ?? "Failed to complete review process.",
      );
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subHeader}>
        Forums with &gt; 10 unique user reports requiring review
      </Text>

      {loading && flaggedPosts.length === 0 ? (
        <ActivityIndicator
          size="large"
          color="#F28E2B"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={flaggedPosts}
          keyExtractor={(item) => item.recipe_forum_id.toString()}
          onRefresh={fetchFlaggedReports}
          refreshing={loading}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No forums currently exceed 10 unique reports.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => handleOpenReview(item)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.forumTitle}>{item.title}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.unique_reporter_count} Unique Reporters
                  </Text>
                </View>
              </View>

              <Text style={styles.reasonLabel}>Reasons:</Text>
              <Text style={styles.reasonsText} numberOfLines={2}>
                {item.combined_reasons}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.totalReportsText}>
                  Total Reports: {item.total_reports}
                </Text>
                <Text style={styles.reviewBtnText}>Review Post &gt;</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Review Flagged Content</Text>
            <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>

          {selectedPost && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Poster:</Text>
                <Text style={styles.infoValue}>
                  {selectedPost.profiles?.display_name ||
                    selectedPost.profiles?.username ||
                    selectedPost.user_id}
                </Text>

                <Text style={styles.infoLabel}>Flag Summary:</Text>
                <Text style={styles.infoValue}>
                  {selectedReportSummary?.unique_reporter_count} unique users (
                  {selectedReportSummary?.total_reports} total)
                </Text>
              </View>

              <Text style={styles.postSectionTitle}>Post Title:</Text>
              <View style={styles.copyRow}>
                <Text style={[styles.postTitle, { flex: 1, marginBottom: 0 }]}>{selectedPost.title}</Text>
                <TouchableOpacity hitSlop={10} onPress={() => copyText("title", selectedPost.title)}>
                  <Ionicons name={copiedKey === "title" ? "checkmark" : "copy-outline"} size={20} color={copiedKey === "title" ? "#34C759" : "#666"} />
                </TouchableOpacity>
              </View>

              {selectedPost.recipes?.recipe_name && (
                <>
                  <Text style={styles.postSectionTitle}>Recipe Name:</Text>
                  <View style={styles.copyRow}>
                    <Text style={[styles.postContent, { flex: 1, marginBottom: 0 }]}>{selectedPost.recipes.recipe_name}</Text>
                    <TouchableOpacity hitSlop={10} onPress={() => copyText("recipe", selectedPost.recipes?.recipe_name ?? "")}>
                      <Ionicons name={copiedKey === "recipe" ? "checkmark" : "copy-outline"} size={20} color={copiedKey === "recipe" ? "#34C759" : "#666"} />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {selectedPost.caption && (
                <>
                  <Text style={styles.postSectionTitle}>Caption:</Text>
                  <Text style={styles.postContent}>{selectedPost.caption}</Text>
                </>
              )}

              {selectedPost.recipes?.recipe_body && (
                <>
                  <Text style={styles.postSectionTitle}>
                    Recipe Instructions:
                  </Text>
                  <Text style={styles.postContent}>
                    {selectedPost.recipes.recipe_body}
                  </Text>
                </>
              )}

              <TouchableOpacity style={styles.openPostBtn} onPress={openPostInForum}>
                <Ionicons name="open-outline" size={18} color="#F28E2B" />
                <Text style={styles.openPostText}>Open post in forum</Text>
              </TouchableOpacity>

              <Text style={styles.actionSectionTitle}>Admin Decision:</Text>

              {submittingAction ? (
                <ActivityIndicator size="small" color="#F28E2B" />
              ) : (
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.dismissBtn]}
                    onPress={() => confirmDecision(false, false)}
                  >
                    <Text style={styles.actionBtnText}>
                      No Fault (Dismiss Reports)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteOnlyBtn]}
                    onPress={() => confirmDecision(true, false)}
                  >
                    <Text style={styles.actionBtnText}>
                      At Fault (Delete Post Only)
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.reasonLabel}>
                    Ban length (for the option below):
                  </Text>
                  <View style={styles.chipsRow}>
                    {BAN_DURATIONS.map((d) => {
                      const on = banDays === d.days;
                      return (
                        <TouchableOpacity
                          key={d.label}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => setBanDays(d.days)}
                        >
                          <Text
                            style={on ? styles.chipTextOn : styles.chipText}
                          >
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.punishBtn]}
                    onPress={() => confirmDecision(true, true)}
                  >
                    <Text style={styles.actionBtnText}>
                      At Fault &amp; Ban Poster
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  subHeader: {
    fontSize: 13,
    color: "#666",
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
  },
  emptyText: { textAlign: "center", marginTop: 40, color: "#888" },
  reportCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  forumTitle: { fontSize: 16, fontWeight: "bold", color: "#222", flex: 1 },
  badge: {
    backgroundColor: "#FFE5E5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeText: { color: "#D32F2F", fontSize: 11, fontWeight: "bold" },
  reasonLabel: { fontSize: 12, fontWeight: "600", color: "#666" },
  reasonsText: { fontSize: 13, color: "#444", marginBottom: 12 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 8,
  },
  totalReportsText: { fontSize: 12, color: "#888" },
  reviewBtnText: { fontSize: 13, color: "#F28E2B", fontWeight: "600" },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: "#FFF", paddingTop: 50 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  modalHeaderTitle: { fontSize: 18, fontWeight: "bold" },
  modalBody: { padding: 20 },
  infoBox: {
    backgroundColor: "#F2F2F7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoLabel: { fontSize: 12, color: "#666", fontWeight: "600" },
  infoValue: { fontSize: 14, color: "#222", marginBottom: 6 },
  postSectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginTop: 10,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 12,
  },
  actionSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginTop: 20,
    marginBottom: 12,
  },
  actionButtonsContainer: { gap: 10, marginBottom: 40 },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  openPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F28E2B",
  },
  openPostText: { color: "#F28E2B", fontWeight: "600", fontSize: 14 },
  dismissBtn: { backgroundColor: "#34C759" },
  deleteOnlyBtn: { backgroundColor: "#FF9500" },
  punishBtn: { backgroundColor: "#FF3B30" },
  actionBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },

  // Ban duration chips
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: "#FFF",
  },
  chipOn: { backgroundColor: "#FF3B30", borderColor: "#FF3B30" },
  chipText: { color: "#444", fontSize: 13 },
  chipTextOn: { color: "#FFF", fontSize: 13, fontWeight: "600" },
});
