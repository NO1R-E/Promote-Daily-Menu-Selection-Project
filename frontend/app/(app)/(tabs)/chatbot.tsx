import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { sendChatMessage } from "../../../src/api/sendChatMessage";
import { MealRecommendation, MessageItem } from "../../../src/types/ChatType";
import { HealthBanner } from "@/components/HealthBanner";
import { useAuth } from "@/src/contexts/AuthContext";
import { useHealth } from "@/src/contexts/HealthContext";
import { supabase } from "@/src/config/supabase";
import { Ionicons } from "@expo/vector-icons";

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const { isServerHealthy } = useHealth();
  const { user } = useAuth();

  const params = useLocalSearchParams<{ currentRoom?: string }>();
  const [currentRoom, setCurrentRoom] = useState<string | null>(
    params.currentRoom ?? null,
  );

  useEffect(() => {
    if (params.currentRoom !== undefined) {
      setCurrentRoom(params.currentRoom);
    }
  }, [params.currentRoom]);

  useEffect(() => {
    const fetchRoomMessages = async () => {
      if (!currentRoom) {
        setMessages([]);
        return;
      }

      setLoading(true);
      const numericRoomId = parseInt(currentRoom, 10);

      const { data, error } = await supabase
        .from("chat_messages")
        .select("massage_id, sender, content, metadata, created_at")
        .eq("room_id", numericRoomId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(
          data.map((m: any) => ({
            id: String(m.massage_id),
            sender: m.sender,
            text: m.content,
            recommendations: m.metadata ? JSON.parse(m.metadata) : [],
          })),
        );
      } else if (error) {
        console.error("Error pulling room history:", error);
      }
      setLoading(false);
    };

    fetchRoomMessages();
  }, [currentRoom]);

  const handleSend = async () => {
    if (!inputText.trim() || loading || !user?.id || !isServerHealthy) return;
    const userText = inputText.trim();
    setInputText("");

    const userMsg: MessageItem = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const data = await sendChatMessage({
        user_id: user.id,
        room_id: currentRoom,
        message: userText,
      });

      if (!currentRoom && data.room_id) {
        setCurrentRoom(String(data.room_id));
      }

      const botMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: data.message,
        recommendations: data.recommendations || [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: `Error: ${err.message || "Failed to reach server"}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderSuggestedActions = () => {
    // หากเริ่มมีข้อความในแชตแล้ว (messages.length > 0) ให้ซ่อนคำแนะนำทั้งหมดทันที
    if (messages.length > 0) return null;

    return (
      <View style={styles.suggestionsContainer}>
        {/* 1. Daily Action */}
        <TouchableOpacity
          style={styles.suggestionCard}
          onPress={() => setInputText("Give me a Plan for today")}
        >
          <Ionicons name="calendar-outline" size={20} color="#FF7A00" />
          <View style={styles.suggestionTextWrapper}>
            <Text style={styles.suggestionTitle}>Give me a Plan for today</Text>
            <Text style={styles.suggestionSub}>
              Generate daily meal & fitness goals
            </Text>
          </View>
        </TouchableOpacity>

        {/* 2. New Chat Quick Prompts */}
        <TouchableOpacity
          style={styles.suggestionCard}
          onPress={() => setInputText("Recommend a meal")}
        >
          <Ionicons name="restaurant-outline" size={20} color="#007AFF" />
          <View style={styles.suggestionTextWrapper}>
            <Text style={styles.suggestionTitle}>Recommend a meal</Text>
            <Text style={styles.suggestionSub}>
              Get tailored food suggestions
            </Text>
          </View>
        </TouchableOpacity>

        {/* 3. Help Command */}
        <TouchableOpacity
          style={styles.suggestionCard}
          onPress={() => setInputText("!help")}
        >
          <Ionicons name="help-circle-outline" size={20} color="#34C759" />
          <View style={styles.suggestionTextWrapper}>
            <Text style={styles.suggestionTitle}>!help</Text>
            <Text style={styles.suggestionSub}>
              See list of available commands & capabilities
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRecommendationCard = (rec: MealRecommendation) => (
    <View key={rec.recipe_id || rec.recipe_name} style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <Text style={styles.mealName}>{rec.recipe_name}</Text>
        {(rec.final_score !== undefined || rec.health_score !== undefined) && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>
              Score {(rec.final_score ?? rec.health_score ?? 0).toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Calories & Protein Badges */}
      <View style={styles.nutritionRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Calories:</Text>
          <Text style={styles.badgeValue}>{rec.calories ?? 0} kcal</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Protein:</Text>
          <Text style={styles.badgeValue}>{rec.protein ?? 0}g</Text>
        </View>
      </View>

      {/* Reason Box */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonTitle}>Why this meal?</Text>
        <Text style={styles.reasonText}>{rec.reason}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <HealthBanner />
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderSuggestedActions}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.sender === "user"
                ? styles.userBubble
                : styles.assistantBubble,
            ]}
          >
            {!!item.text && (
              <Text
                style={[
                  styles.bubbleText,
                  item.sender === "user"
                    ? styles.userText
                    : styles.assistantText,
                ]}
              >
                {item.text}
              </Text>
            )}

            {item.recommendations && item.recommendations.length > 0 && (
              <View style={styles.recommendationsList}>
                {item.recommendations.map(renderRecommendationCard)}
              </View>
            )}
          </View>
        )}
      />

      {loading && <ActivityIndicator style={styles.loader} color="#007AFF" />}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !user?.id && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!user?.id || loading || !isServerHealthy}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  listContent: { padding: 16, gap: 10 },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 16 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#007AFF" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#E5E5EA" },
  bubbleText: { fontSize: 15 },
  userText: { color: "#FFFFFF" },
  assistantText: { color: "#000000" },

  // Recommendation Card Styles
  recommendationsList: { marginTop: 8, gap: 10 },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mealName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  scoreBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2E7D32",
  },
  nutritionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
    gap: 4,
  },
  badgeLabel: {
    fontSize: 12,
    color: "#6C6C70",
  },
  badgeValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  reasonBox: {
    backgroundColor: "#F0F4F8",
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#007AFF",
  },
  reasonTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: "#3A3A3C",
    lineHeight: 18,
  },

  loader: { marginVertical: 6 },
  inputBar: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderColor: "#DDD",
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  sendBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendText: { color: "#007AFF", fontWeight: "600" },
  suggestionsContainer: {
    marginBottom: 16,
    gap: 10,
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  suggestionSub: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
});
