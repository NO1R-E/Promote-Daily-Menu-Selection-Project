import { useCallback, useEffect, useRef, useState } from "react";
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
import { useFocusEffect, useRouter } from "expo-router";
import { sendChatMessage } from "../../../src/api/sendChatMessage";
import { getCookTips } from "../../../src/api/getCookTips";
import { MealRecommendation, MessageItem } from "../../../src/types/ChatType";
import { HealthBanner } from "@/components/HealthBanner";
import { useAuth } from "@/src/contexts/AuthContext";
import { useHealth } from "@/src/contexts/HealthContext";
import { supabase } from "@/src/config/supabase";
import { Ionicons } from "@expo/vector-icons";
import { likeMeal } from "@/src/api/record";
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

function TypingIndicator() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setDots((d) => (d % 3) + 1), 400);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={[styles.bubble, styles.assistantBubble]}>
      <Text style={[styles.bubbleText, styles.assistantText]}>
        Chat is thinking{" .".repeat(dots)}
      </Text>
    </View>
  );
}

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const { isServerHealthy } = useHealth();
  const { user } = useAuth();
  const { currentRoom, setCurrentRoom, cooking, setCooking } = useChatRoom();
  const [roomReady, setRoomReady] = useState(false); // room history has been loaded (or there is none)

  const router = useRouter();

  const listRef = useRef<FlatList<MessageItem>>(null);
  const skipFetchRef = useRef(false);

  const sendingRef = useRef(false);
  const cookRef = useRef<{ recipe_id: number; step: number } | null>(null);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const images = useRecipeImages(
    messages.flatMap((m) =>
      (m.recommendations ?? []).map((r) => Number(r.recipe_id)),
    ),
  );
  // console.log("ChatbotScreen: images", images);
  const [likeState, setLikeState] = useState<
    Record<string, "asking" | "yes" | "no">
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const fetchRoomMessages = async () => {
      if (!user?.id) return;
      if (skipFetchRef.current) {
        skipFetchRef.current = false;
        setRoomReady(true);
        return;
      }
      if (!currentRoom) {
        setMessages([]);
        setRoomReady(true);
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
      if (!cancelled) {
        setLoading(false);
        setRoomReady(true);
      }
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
  }, [messages.length, waiting]);

  useEffect(() => {
    return onRoomDeleted((deletedId) => {
      if (currentRoom === deletedId) {
        skipFetchRef.current = false;
        setCurrentRoom(null);
      }
    });
  }, [currentRoom]);

  // no typing or sending while a message is in flight, and from the moment cooking starts until its opening reply
  const inputLocked =
    !user?.id || loading || !isServerHealthy || !!cooking?.pendingStart;

  const handleSend = () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    send(text);
  };

  useEffect(() => {
    cookRef.current = cooking
      ? { recipe_id: cooking.recipe_id, step: cooking.step }
      : null;
  }, [cooking?.recipe_id, cooking?.step]);

  // Tips: ONE request when cooking starts (the server asks the LLM once for the whole recipe). After that a step's
  // tip is just looked up here, so nothing more is sent. Each tip pops once, the first time its step is shown.
  const tipsRef = useRef<{
    recipeId: number;
    tips: Record<number, string>;
    shown: Set<number>;
  } | null>(null);

  const showTipFor = (recipeId: number, step: number) => {
    const t = tipsRef.current;
    if (!t || t.recipeId !== recipeId || t.shown.has(step) || !t.tips[step])
      return;
    t.shown.add(step);
    setMessages((prev) => [
      ...prev,
      {
        id: `tip-${recipeId}-${step}`,
        sender: "assistant",
        text: `TIPS: ${t.tips[step]}`,
        tip: true,
      },
    ]);
  };

  const loadTips = async (recipeId: number) => {
    tipsRef.current = { recipeId, tips: {}, shown: new Set() };
    const tips = await getCookTips(recipeId);
    if (tipsRef.current?.recipeId !== recipeId) return; // cooking ended or another recipe started meanwhile
    tipsRef.current.tips = tips;
    const now = cookRef.current;
    if (now && now.recipe_id === recipeId && now.step > 0)
      showTipFor(recipeId, now.step); // user was faster than the tips
  };

  const send = async (text: string) => {
    if (sendingRef.current) return;
    if (!text.trim() || loading || !user?.id || !isServerHealthy) return;
    sendingRef.current = true;
    const userText = text.trim();
    setLoading(true);
    setWaiting(true);

    // show the user's bubble at once; the room check below is a network round trip
    const userMsg: MessageItem = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
    };
    setMessages((prev) => [...prev, userMsg]);

    // ห้องที่เปิดอยู่ถูกลบไปแล้ว (จากลิ้นชัก/อุปกรณ์อื่น): ส่งเป็นห้องใหม่ ไม่ส่งเข้าห้องที่ไม่มีอยู่
    let roomId = currentRoom;
    if (roomId) {
      try {
        const { data: stillThere, error: roomError } = await supabase
          .from("chat_rooms")
          .select("room_id")
          .eq("room_id", parseInt(roomId, 10))
          .maybeSingle();
        if (!roomError && !stillThere) {
          roomId = null;
          setMessages([userMsg]);
        }
      } catch {
        // the check is best effort; send to the room we have
      }
    }

    try {
      const data = await sendChatMessage({
        user_id: user.id,
        room_id: roomId,
        message: userText,
        cooking: cooking
          ? { recipe_id: cooking.recipe_id, step: cooking.step }
          : null,
      });

      // cooking mode: the server returns the step to keep, or says cooking is over
      if (cooking) {
        if (data.cooking_ended || !data.cooking) setCooking(null);
        else {
          const next = data.cooking;
          setCooking((c) => (c ? { ...c, step: next.step } : c));
        }
      }

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

      console.log(
        "[chat] recommendations",
        (botMsg.recommendations ?? []).map((r: any) => ({
          id: r.recipe_id,
          name: r.recipe_name,
          health: r.health_score,
          liking: r.liking_score,
          final: r.final_score,
        })),
      );
      setMessages((prev) => [...prev, botMsg]);

      // cooking: a new step was shown ("Step N/M ...") -> pop its tip, if it has one
      if (
        cooking &&
        data.cooking &&
        !data.cooking_ended &&
        data.cooking.step !== cooking.step &&
        /^Step \d+\//.test(data.message)
      ) {
        showTipFor(cooking.recipe_id, data.cooking.step);
      }
      if (cooking && (data.cooking_ended || !data.cooking))
        tipsRef.current = null;

      // asked after every suggestion (no cooldown); it is only shown on the newest suggestion, see latestRecId
      if ((botMsg.recommendations?.length ?? 0) > 0) {
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
      sendingRef.current = false;
      setLoading(false);
      setWaiting(false);
    }
  };

  // Opening message of cooking mode: sent once, after the room history has loaded
  useEffect(() => {
    if (!cooking?.pendingStart || !focused || !roomReady || loading) return;
    if (!user?.id || !isServerHealthy) return;
    console.log("[cook] sending opening message for", cooking.name); // one line per tap = healthy
    setCooking((c) => (c ? { ...c, pendingStart: false } : c));
    loadTips(cooking.recipe_id); // the one LLM call of this cooking session, runs while the intro is shown
    send(`Cook ${cooking.name}`);
  }, [
    cooking?.pendingStart,
    focused,
    roomReady,
    loading,
    user?.id,
    isServerHealthy,
  ]);

  // Answer to "Do you like this suggestion?" Yes = like every meal currently shown in that message
  const onAnswerLike = async (messageId: string, liked: boolean) => {
    setLikeState((st) => ({ ...st, [messageId]: liked ? "yes" : "no" }));
    if (!liked) return;
    const recs =
      messages.find((m) => m.id === messageId)?.recommendations ?? [];
    await Promise.allSettled(recs.map((r) => likeMeal(Number(r.recipe_id))));
  };

  // the "Do you like this suggestion?" prompt is only shown under the newest message that has meal cards
  const latestRecId = [...messages]
    .reverse()
    .find((m) => (m.recommendations?.length ?? 0) > 0)?.id;

  const renderSuggestedActions = () => {
    // หากเริ่มมีข้อความในแชตแล้ว (messages.length > 0) ให้ซ่อนคำแนะนำทั้งหมดทันที
    // (cooking mode: the other features are off, so no suggestions either)
    if (messages.length > 0 || cooking) return null;

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
    const cardKey = `${messageId}-${index}-${rec.recipe_id}`;
    const open = !!expanded[cardKey];
    const fmt = (n?: number) =>
      n === undefined || n === null ? "-" : n.toFixed(2);

    return (
      <View key={cardKey} style={styles.cardContainer}>
        <View style={styles.cardBody}>
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
                    Score{" "}
                    {(rec.final_score ?? rec.health_score ?? 0).toFixed(2)}
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
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() =>
                  setExpanded((e) => ({ ...e, [cardKey]: !e[cardKey] }))
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.chevronBtn}
              >
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#8E8E93"
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>

        {open && (
          <View style={styles.flap}>
            <Text style={styles.reasonTitle}>Why this meal?</Text>
            <Text style={styles.reasonText}>{rec.reason}</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreItem}>
                Health {fmt(rec.health_score)}
              </Text>
              <Text style={styles.scoreItem}>
                Liking {fmt(rec.liking_score)}
              </Text>
              <Text style={styles.scoreItem}>
                Novelty {fmt(rec.novelty_score)}
              </Text>
              <Text style={styles.scoreItem}>Fit {fmt(rec.fit_score)}</Text>
            </View>
          </View>
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
      {cooking && (
        <View style={styles.cookBanner}>
          <Ionicons name="flame" size={18} color="#FF7A00" />
          <Text style={styles.cookBannerText} numberOfLines={1}>
            Cooking: {cooking.name}
            {cooking.step > 0 ? ` · step ${cooking.step}` : ""}
          </Text>
          <TouchableOpacity
            onPress={() => setCooking(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.cookExit}>Exit</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={messages}
        extraData={[likeState, latestRecId]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderSuggestedActions}
        ListFooterComponent={waiting ? <TypingIndicator /> : null}
        renderItem={({ item }) => {
          const recs = item.recommendations ?? [];

          return (
            <View
              style={[
                styles.bubble,
                item.sender === "user"
                  ? styles.userBubble
                  : styles.assistantBubble,
                recs.length > 0 && styles.bubbleWide,
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

              {recs.length > 0 &&
                likeState[item.id] === "asking" &&
                item.id === latestRecId && (
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

      {loading && !waiting && (
        <ActivityIndicator style={styles.loader} color="#FF7A00" />
      )}

      {cooking && (
        <View
          style={[
            styles.cookChips,
            {
              backgroundColor: "#F5F5F5",
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          {["Repeat", "Ingredients", "Back step", "Next step"].map((label) => (
            <TouchableOpacity
              key={label}
              style={styles.cookChip}
              disabled={inputLocked}
              onPress={() => send(label)}
            >
              <Text style={styles.cookChipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={
            cooking ? "Ask about this recipe..." : "Type a message..."
          }
          value={inputText}
          onChangeText={setInputText}
          editable={!inputLocked}
        />
        <TouchableOpacity
          style={[styles.sendBtn, inputLocked && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={inputLocked}
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
  // a bubble with meal cards has a fixed width, so opening the "why" panel wraps text instead of growing the card
  bubbleWide: { width: "85%" },
  bubbleText: { fontSize: 15 },
  userText: { color: "#FFFFFF" },
  assistantText: { color: "#000000" },
  recommendationsList: { marginTop: 8, gap: 10 },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  cardBody: { padding: 12 },
  chevronBtn: { paddingHorizontal: 4 },
  // slightly gray panel tucked under the card
  flap: {
    backgroundColor: "#F0F0F2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E4E4E7",
  },
  scoreRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  scoreItem: { fontSize: 12, color: "#6C6C70", fontWeight: "500" },
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

  cookBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFF3E0",
    borderBottomWidth: 1,
    borderColor: "#FFEAD5",
  },
  cookBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#C96A0A",
  },
  cookExit: { fontSize: 13, fontWeight: "700", color: "#B3261E" },
  cookChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
  },
  cookChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FF7A00",
    backgroundColor: "#FFF5EA",
  },
  cookChipText: { fontSize: 13, fontWeight: "600", color: "#C96A0A" },

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
