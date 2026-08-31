import { useAuth } from "@/src/contexts/AuthContext";
import { useState } from "react";
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
import { sendChatMessage } from "../../../src/api/sendChatMessage";
import { MealRecommendation, MessageItem } from "../../../src/types/ChatType";

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const { user } = useAuth();

  const handleSend = async () => {
    if (!inputText.trim() || loading || !user?.id) return;

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
        setCurrentRoom(data.room_id);
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

  const renderRecommendationCard = (rec: MealRecommendation) => (
    // 💡 1. Use rec.recipe_id or rec.recipe_name as key
    <View key={rec.recipe_id || rec.recipe_name} style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        {/* 💡 2. Render rec.recipe_name instead of rec.name */}
        <Text style={styles.mealName}>{rec.recipe_name}</Text>

        {/* 💡 3. Handle Score Badge rendering (rec.final_score or rec.score) */}
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
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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
          disabled={!user?.id || loading}
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
});
