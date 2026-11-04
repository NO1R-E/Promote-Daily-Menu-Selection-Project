import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { sendChatMessage } from "../../../src/api/sendChatMessage";
import { MealRecommendation, MessageItem } from "../../../src/types/ChatType";
import { HealthBanner } from "@/components/HealthBanner";
import { useAuth } from "@/src/contexts/AuthContext";
import { useHealth } from "@/src/contexts/HealthContext";
import { supabase } from "@/src/config/supabase";
import { Ionicons } from "@expo/vector-icons";
import { likeMeal } from "@/src/api/record";
import { markAskedLike, shouldAskLike } from "@/src/utils/likePrompt";
import { openRecipeInForum } from "@/src/utils/openRecipe";
import { useRecipeImages } from "@/src/hooks/useRecipeImages";
import { emitRoomsChanged, onRoomDeleted } from "@/src/utils/chatRoomEvents";
import { useChatRoom } from "@/src/contexts/ChatRoomContext";

// metadata ที่เก็บในฐานข้อมูลเป็น {"recommendations":[...]} (บางแถวเก่าอาจเป็น array ตรง ๆ)
function parseRecommendations(metadata: string | null): MealRecommendation[] {
  if (!metadata) return [];
  try {
    const parsed = JSON.parse(metadata);
    const list = Array.isArray(parsed) ? parsed : parsed?.recommendations;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const { isServerHealthy } = useHealth();
  const { user } = useAuth();
  const { currentRoom, setCurrentRoom } = useChatRoom();

  const router = useRouter();

  const listRef = useRef<FlatList<MessageItem>>(null);
  const skipFetchRef = useRef(false);
  const images = useRecipeImages(
    messages.flatMap((m) =>
      (m.recommendations ?? []).map((r) => Number(r.recipe_id)),
    ),
  );
  console.log("ChatbotScreen: images", images);
  const [likeState, setLikeState] = useState<
    Record<string, "asking" | "yes" | "no">
  >({});

  useEffect(() => {
    let cancelled = false;

    const fetchRoomMessages = async () => {
      if (!user?.id) return;
      if (skipFetchRef.current) {
        skipFetchRef.current = false;
        return;
      }
      if (!currentRoom) {
        setMessages([]);
        return;
      }

      setLoading(true);
      const numericRoomId = parseInt(currentRoom, 10);

      const { data, error } = await supabase
        .from("chat_messages")
        .select("massage_id, sender, content, intent, metadata, created_at")
        .eq("room_id", numericRoomId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Error pulling room history:", error);
      } else if (data) {
        const items: MessageItem[] = data.map((m: any) => ({
          id: String(m.massage_id),
          sender: m.sender,
          text: m.content,
          intent: m.intent ?? null,
          recommendations: parseRecommendations(m.metadata),
        }));
        setMessages(items);
      }
      if (!cancelled) setLoading(false);
    };

    fetchRoomMessages();
    return () => {
      cancelled = true;
    };
  }, [currentRoom, user?.id]);

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(t);
  }, [messages.length]);

  useEffect(() => {
    return onRoomDeleted((deletedId) => {
      if (currentRoom === deletedId) {
        skipFetchRef.current = false;
        setCurrentRoom(null);
      }
    });
  }, [currentRoom]);

  const handleSend = async () => {
    if (!inputText.trim() || loading || !user?.id || !isServerHealthy) return;
    const userText = inputText.trim();
    setInputText("");
    setLoading(true);

    // ห้องที่เปิดอยู่ถูกลบไปแล้ว (จากลิ้นชัก/อุปกรณ์อื่น): ส่งเป็นห้องใหม่ ไม่ส่งเข้าห้องที่ไม่มีอยู่
    let roomId = currentRoom;
    if (roomId) {
      const { data: stillThere, error: roomError } = await supabase
        .from("chat_rooms")
        .select("room_id")
        .eq("room_id", parseInt(roomId, 10))
        .maybeSingle();
      if (!roomError && !stillThere) {
        roomId = null;
        setMessages([]);
      }
    }

    const userMsg: MessageItem = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const data = await sendChatMessage({
        user_id: user.id,
        room_id: roomId,
        message: userText,
      });

      if (data.room_id && String(data.room_id) !== (roomId ?? "")) {
        const newRoom = String(data.room_id);
        skipFetchRef.current = true;
        setCurrentRoom(newRoom);
        emitRoomsChanged(newRoom);
      }

      const botMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: data.message,
        intent: (data as any).intent ?? null,
        recommendations: data.recommendations || [],
      };

      setMessages((prev) => [...prev, botMsg]);

      // ask "Do you like this suggestion?" at most once a day
      if (
        (botMsg.recommendations?.length ?? 0) > 0 &&
        (await shouldAskLike(user.id))
      ) {
        markAskedLike(user.id);
        setLikeState((s) => ({ ...s, [botMsg.id]: "asking" }));
      }
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

  // Answer to "Do you like this suggestion?" Yes = like every meal currently shown in that message
  const onAnswerLike = async (messageId: string, liked: boolean) => {
    setLikeState((st) => ({ ...st, [messageId]: liked ? "yes" : "no" }));
    if (!liked) return;
    const recs =
      messages.find((m) => m.id === messageId)?.recommendations ?? [];
    await Promise.allSettled(recs.map((r) => likeMeal(Number(r.recipe_id))));
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
          <Ionicons name="restaurant-outline" size={20} color="#FF7A00" />
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
          <Ionicons name="help-circle-outline" size={20} color="#FF7A00" />
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

  const renderRecommendationCard = (
    rec: MealRecommendation,
    messageId: string,
    index: number,
  ) => {
    const img = images[Number(rec.recipe_id)];

    return (
      <View
        key={`${messageId}-${index}-${rec.recipe_id}`}
        style={styles.cardContainer}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => openRecipeInForum(router, rec.recipe_id)}
        >
          {!!img && <Image source={{ uri: img }} style={styles.cardImage} />}
          {!!rec.meal_type && (
            <Text style={styles.mealTypeTag}>{rec.meal_type}</Text>
          )}
          <View style={styles.cardHeader}>
            <Text style={styles.mealName} numberOfLines={2}>
              {rec.recipe_name}
            </Text>
            {(rec.final_score !== undefined ||
              rec.health_score !== undefined) && (
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>
                  Score {(rec.final_score ?? rec.health_score ?? 0).toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.nutritionRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Calories:</Text>
              <Text style={styles.badgeValue}>
                {Math.round(rec.calories ?? 0)} kcal
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Protein:</Text>
              <Text style={styles.badgeValue}>
                {Math.round(rec.protein ?? 0)} g
              </Text>
            </View>
          </View>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>Why this meal?</Text>
            <Text style={styles.reasonText}>{rec.reason}</Text>
          </View>
          <Text style={styles.openHint}>Tap to open the recipe</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <HealthBanner />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderSuggestedActions}
        renderItem={({ item }) => {
          const recs = item.recommendations ?? [];

          return (
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

              {recs.length > 0 && (
                <View style={styles.recommendationsList}>
                  {recs.map((rec, i) =>
                    renderRecommendationCard(rec, item.id, i),
                  )}
                </View>
              )}

              {recs.length > 0 && likeState[item.id] === "asking" && (
                <View style={styles.likePrompt}>
                  <Text style={styles.likePromptText}>
                    Do you like this suggestion?
                  </Text>
                  <View style={styles.likePromptRow}>
                    <TouchableOpacity
                      style={styles.likeYesBtn}
                      onPress={() => onAnswerLike(item.id, true)}
                    >
                      <Ionicons
                        name="thumbs-up-outline"
                        size={14}
                        color="#FFFFFF"
                      />
                      <Text style={styles.likeYesText}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.likeNoBtn}
                      onPress={() => onAnswerLike(item.id, false)}
                    >
                      <Text style={styles.likeNoText}>Not really</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        setLikeState((st) => ({ ...st, [item.id]: "no" }))
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={18} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {(likeState[item.id] === "yes" || likeState[item.id] === "no") &&
                recs.length > 0 && (
                  <Text style={styles.likeThanks}>
                    {likeState[item.id] === "yes"
                      ? "Thanks! We'll suggest more like this."
                      : "Thanks for the feedback."}
                  </Text>
                )}
            </View>
          );
        }}
      />

      {loading && <ActivityIndicator style={styles.loader} color="#FF7A00" />}

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
  userBubble: { alignSelf: "flex-end", backgroundColor: "#FF7A00" },
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
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E66E00",
  },
  nutritionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    flexDirection: "row",
    backgroundColor: "#FFF8F0",
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
    backgroundColor: "#FFF8F0",
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#FF7A00",
  },
  reasonTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF7A00",
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: "#3A3A3C",
    lineHeight: 18,
  },
  mealTypeTag: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6C6C70",
    textTransform: "capitalize",
    marginBottom: 4,
  },
  openHint: { fontSize: 11, color: "#8E8E93", marginTop: 6 },
  cardImage: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#F0F0F0",
  },

  likePrompt: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFEAD5",
  },
  likePromptText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  likePromptRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  likeYesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FF7A00",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  likeYesText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  likeNoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FF7A00",
  },
  likeNoText: { color: "#FF7A00", fontWeight: "600", fontSize: 13 },
  likeThanks: { fontSize: 12, color: "#6C6C70", marginTop: 6 },

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
  sendText: { color: "#FF7A00", fontWeight: "600" },
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
    borderColor: "#FFEAD5",
    gap: 12,
    shadowColor: "#FF7A00",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
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
