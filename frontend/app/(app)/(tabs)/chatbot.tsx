import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { sendChatMessage } from "../../../src/api/sendChatMessage";
import { MealRecommendation, MessageItem } from "../../../src/types/ChatType";
import { HealthBanner } from "@/components/HealthBanner";
import { useAuth } from "@/src/contexts/AuthContext";
import { useHealth } from "@/src/contexts/HealthContext";
import { supabase } from "@/src/config/supabase";
import { Ionicons } from "@expo/vector-icons";
import { localDateString } from "@/src/utils/date";
import { openRecipeInForum } from "@/src/utils/openRecipe";
import { anotherMeal } from "@/src/api/meal";
import { emitRoomsChanged, onRoomDeleted } from "@/src/utils/chatRoomEvents";

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

// การ์ดแต่ละใบ = ข้อความ + ลำดับในข้อความนั้น (แผนมีหลายใบต่อข้อความ)
const cardKey = (messageId: string, index: number) => `${messageId}:${index}`;

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const { isServerHealthy } = useHealth();
  const { user } = useAuth();

  const router = useRouter();

  const listRef = useRef<FlatList<MessageItem>>(null);
  const skipFetchRef = useRef(false);
  const seenRef = useRef<Record<string, number[]>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null); // กำลังขอ Another
  const [loggingKey, setLoggingKey] = useState<string | null>(null); // กำลังบันทึก/ยกเลิก
  const [logged, setLogged] = useState<Record<string, string>>({}); // cardKey -> record_item_id

  const params = useLocalSearchParams<{ currentRoom?: string }>();
  const [currentRoom, setCurrentRoom] = useState<string | null>(
    params.currentRoom ?? null,
  );

  useEffect(() => {
    if (params.currentRoom !== undefined) {
      setCurrentRoom(params.currentRoom);
    }
  }, [params.currentRoom]);

  // เข้าห้องเดิม: การ์ดที่วันนี้บันทึกไปแล้วต้องขึ้น Logged และล็อก Another
  const hydrateLogged = async (items: MessageItem[]) => {
    if (!user?.id) return;
    const ids = new Set<number>();
    items.forEach((m) =>
      (m.recommendations ?? []).forEach((r) => ids.add(Number(r.recipe_id))),
    );
    if (ids.size === 0) {
      setLogged({});
      return;
    }
    const { data } = await supabase
      .from("record_item")
      .select("record_item_id, recipe_id, meal_type")
      .eq("user_id", user.id)
      .eq("record_date", localDateString())
      .in("recipe_id", Array.from(ids));

    const next: Record<string, string> = {};
    items.forEach((m) =>
      (m.recommendations ?? []).forEach((r, i) => {
        const hit = (data ?? []).find(
          (d: any) =>
            Number(d.recipe_id) === Number(r.recipe_id) &&
            (!r.meal_type || d.meal_type === r.meal_type),
        );
        if (hit) next[cardKey(m.id, i)] = hit.record_item_id;
      }),
    );
    setLogged(next);
  };

  useEffect(() => {
    const fetchRoomMessages = async () => {
      // ห้องที่เพิ่งสร้างจากหน้านี้: ข้อความอยู่บนจออยู่แล้ว ไม่โหลดทับ
      if (skipFetchRef.current) {
        skipFetchRef.current = false;
        return;
      }
      if (!currentRoom) {
        setMessages([]);
        setLogged({});
        return;
      }

      setLoading(true);
      const numericRoomId = parseInt(currentRoom, 10);

      const { data, error } = await supabase
        .from("chat_messages")
        .select("massage_id, sender, content, intent, metadata, created_at")
        .eq("room_id", numericRoomId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        const items: MessageItem[] = data.map((m: any) => ({
          id: String(m.massage_id),
          sender: m.sender,
          text: m.content,
          intent: m.intent ?? null,
          recommendations: parseRecommendations(m.metadata),
        }));
        setMessages(items);
        await hydrateLogged(items);
      } else if (error) {
        console.error("Error pulling room history:", error);
      }
      setLoading(false);
    };

    fetchRoomMessages();
  }, [currentRoom, user?.id]);

  // เลื่อนไปข้อความล่าสุดเมื่อจำนวนข้อความเปลี่ยน (โหลดประวัติ / ส่งข้อความใหม่)
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
        setCurrentRoom(null); // effect โหลดห้องจะล้างข้อความให้เอง
        setLogged({});
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
        setLogged({});
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
        router.setParams({ currentRoom: newRoom });
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

  const onAnother = async (messageId: string, index: number) => {
    if (!user?.id || busyKey || loggingKey) return;
    const key = cardKey(messageId, index);
    if (logged[key]) return;

    const recs =
      messages.find((m) => m.id === messageId)?.recommendations ?? [];
    const rec = recs[index];
    if (!rec) return;

    setBusyKey(key);
    try {
      const base = seenRef.current[key] ?? [Number(rec.recipe_id)];
      // แผนหลายมื้อ: ไม่ให้ได้สูตรซ้ำกับมื้ออื่นในข้อความเดียวกัน
      const others = recs
        .filter((_, i) => i !== index)
        .map((r) => Number(r.recipe_id));
      const seen = Array.from(new Set([...base, ...others]));

      const next = await anotherMeal({
        userId: user.id,
        mealType: rec.meal_type ?? null,
        seenIds: seen,
        preferences: rec.preferences ?? [],
      });
      if (!next) {
        Alert.alert(
          "No other recipe fits",
          "You've seen everything that matches right now.",
        );
        return;
      }
      seenRef.current[key] = [...base, Number(next.recipe_id)];
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                recommendations: (m.recommendations ?? []).map((r, i) =>
                  i === index ? next : r,
                ),
              }
            : m,
        ),
      );
    } catch (err: any) {
      Alert.alert("Couldn't get another meal", err.message);
    } finally {
      setBusyKey(null);
    }
  };

  // Ate it / Logged: กดครั้งแรกบันทึก กดอีกครั้งลบบันทึกแล้วปลดล็อก Another
  const onToggleLogged = async (messageId: string, index: number) => {
    if (!user?.id || loggingKey) return;
    const key = cardKey(messageId, index);
    const rec = messages.find((m) => m.id === messageId)?.recommendations?.[
      index
    ];
    if (!rec) return;

    setLoggingKey(key);
    try {
      const existingId = logged[key];
      if (existingId) {
        const { error } = await supabase
          .from("record_item")
          .delete()
          .eq("record_item_id", existingId);
        if (error) {
          Alert.alert("Couldn't undo", error.message);
          return;
        }
        setLogged((l) => {
          const { [key]: _removed, ...rest } = l;
          return rest;
        });
        return;
      }

      const today = localDateString();
      const recipeId = Number(rec.recipe_id);

      // ถ้าวันนี้มีบันทึกสูตรนี้ (มื้อเดียวกัน) อยู่แล้ว ใช้อันเดิม ไม่เพิ่มซ้ำ
      let q = supabase
        .from("record_item")
        .select("record_item_id")
        .eq("user_id", user.id)
        .eq("record_date", today)
        .eq("recipe_id", recipeId);
      if (rec.meal_type) q = q.eq("meal_type", rec.meal_type);
      const { data: existing } = await q.limit(1);

      let recordId: string | undefined = existing?.[0]?.record_item_id;
      if (!recordId) {
        const { data, error } = await supabase
          .from("record_item")
          .insert({
            user_id: user.id,
            recipe_id: recipeId,
            meal_type: rec.meal_type ?? null,
            record_date: today,
          })
          .select("record_item_id")
          .single();
        if (error) {
          Alert.alert("Couldn't save this meal", error.message);
          return;
        }
        recordId = data.record_item_id;
      }
      setLogged((l) => ({ ...l, [key]: recordId as string }));
    } finally {
      setLoggingKey(null);
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

  const renderRecommendationCard = (
    rec: MealRecommendation,
    messageId: string,
    index: number,
  ) => {
    const key = cardKey(messageId, index);
    const isLogged = !!logged[key];
    const anotherBusy = busyKey === key;
    const logBusy = loggingKey === key;

    return (
      <View
        key={`${messageId}-${index}-${rec.recipe_id}`}
        style={styles.cardContainer}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => openRecipeInForum(router, rec.recipe_id)}
        >
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

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[
              styles.cardBtn,
              { flex: 1 },
              (isLogged || !!busyKey || !!loggingKey) && styles.cardBtnLocked,
            ]}
            onPress={() => onAnother(messageId, index)}
            disabled={isLogged || !!busyKey || !!loggingKey}
          >
            {anotherBusy ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.cardBtnText}>Another</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cardBtn,
              { flex: 1 },
              isLogged && styles.cardBtnLogged,
            ]}
            onPress={() => onToggleLogged(messageId, index)}
            disabled={logBusy}
          >
            {logBusy ? (
              <ActivityIndicator
                size="small"
                color={isLogged ? "#2E7D32" : "#007AFF"}
              />
            ) : isLogged ? (
              <View style={styles.loggedRow}>
                <Ionicons name="checkmark" size={16} color="#2E7D32" />
                <Text style={styles.cardBtnTextLogged}>Logged</Text>
              </View>
            ) : (
              <Text style={styles.cardBtnText}>Ate it</Text>
            )}
          </TouchableOpacity>
        </View>

        {isLogged && (
          <Text style={styles.undoHint}>
            Tap Logged to undo and unlock Another.
          </Text>
        )}
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
            </View>
          );
        }}
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
    flexWrap: "wrap",
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
  mealTypeTag: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6C6C70",
    textTransform: "capitalize",
    marginBottom: 4,
  },
  openHint: { fontSize: 11, color: "#8E8E93", marginTop: 6 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  cardBtn: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBtnText: { color: "#007AFF", fontWeight: "600", fontSize: 14 },
  cardBtnLocked: { opacity: 0.4 },
  cardBtnLogged: { borderColor: "#2E7D32", backgroundColor: "#E8F5E9" },
  cardBtnTextLogged: { color: "#2E7D32", fontWeight: "600", fontSize: 14 },
  loggedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  undoHint: { fontSize: 11, color: "#6C6C70", marginTop: 6 },

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
