import React, { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

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
  recipes: {
    recipe_name: string | null;
    recipe_body: string | null;
  } | null;
  profiles: {
    username: string;
    display_name: string | null;
  } | null;
};

export default function AdminReportsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedForum[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal States
  const [selectedPost, setSelectedPost] = useState<FullForumDetail | null>(
    null,
  );
  const [selectedReportSummary, setSelectedReportSummary] =
    useState<FlaggedForum | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Logout Modal State
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

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

  useEffect(() => {
    fetchFlaggedReports();
  }, []);

  const handleOpenReview = async (item: FlaggedForum) => {
    setSelectedReportSummary(item);

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

  const handleReviewDecision = async (
    isFault: boolean,
    punishPoster: boolean,
  ) => {
    if (!selectedPost || !user) return;
    setSubmittingAction(true);
    try {
      const statusToUpdate = isFault ? "reviewed" : "dismissed";
      const { error: reportErr } = await supabase
        .from("reports")
        .update({
          report_status: statusToUpdate,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("forum_id", selectedPost.recipe_forum_id);
      if (reportErr) throw reportErr;
      if (isFault) {
        const { error: hideErr } = await supabase
          .from("recipe_forum")
          .update({ is_hidden: true })
          .eq("recipe_forum_id", selectedPost.recipe_forum_id);

        if (hideErr) throw hideErr;
        if (punishPoster && selectedPost.user_id) {
          const { error: banErr } = await supabase
            .from("profiles")
            .update({ user_status: true })
            .eq("profile_id", selectedPost.user_id);

          if (banErr) throw banErr;
        }
      }

      Alert.alert("Success", "Review completed.");
      setReviewModalVisible(false);
      fetchFlaggedReports();
    } catch (err: any) {
      console.error("Error applying review decision:", err);
      Alert.alert("Error", "Failed to complete review process.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setIsLogoutModalVisible(false);
      router.replace("/(auth)/login");
    } catch (error: any) {
      console.error("Error signing out:", error.message);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Flagged Reports Queue</Text>
        <TouchableOpacity onPress={() => setIsLogoutModalVisible(true)}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subHeader}>
        Forums with &gt; 10 unique user reports requiring review
      </Text>

      {loading ? (
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

      {/* Review Modal */}
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
              <Text style={styles.postTitle}>{selectedPost.title}</Text>

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

              <Text style={styles.actionSectionTitle}>Admin Decision:</Text>

              {submittingAction ? (
                <ActivityIndicator size="small" color="#F28E2B" />
              ) : (
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.dismissBtn]}
                    onPress={() => handleReviewDecision(false, false)}
                  >
                    <Text style={styles.actionBtnText}>
                      No Fault (Dismiss Reports)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteOnlyBtn]}
                    onPress={() => handleReviewDecision(true, false)}
                  >
                    <Text style={styles.actionBtnText}>
                      At Fault (Delete Post Only)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.punishBtn]}
                    onPress={() => handleReviewDecision(true, true)}
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

      {/* Logout Modal */}
      <Modal
        visible={isLogoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.logoutIconCircle}>
              <Ionicons name="log-out" size={32} color="#FF3B30" />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalSubTitle}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsLogoutModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.logoutConfirmButton]}
                onPress={handleLogout}
              >
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA", paddingTop: 50 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#333" },
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
  dismissBtn: { backgroundColor: "#34C759" },
  deleteOnlyBtn: { backgroundColor: "#FF9500" },
  punishBtn: { backgroundColor: "#FF3B30" },
  actionBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },

  // Logout modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    width: "80%",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  logoutIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  modalSubTitle: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: { backgroundColor: "#F2F2F7", marginRight: 10 },
  cancelButtonText: { color: "#8E8E93", fontSize: 16, fontWeight: "600" },
  logoutConfirmButton: {
    backgroundColor: "#FF3B30",
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});
