import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { HealthBanner } from "@/components/HealthBanner";
import MealShareSliders from "@/components/MealShareSliders";
import { anotherMeal } from "@/src/api/meal";
import { generatePlan, rerollSlot } from "@/src/api/plan";
import { useRecipeImages } from "@/src/hooks/useRecipeImages";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import { useHealth } from "@/src/contexts/HealthContext";
import {
  DEFAULT_SHARES,
  Plan,
  PlanMeal,
  SLOTS,
  SLOT_LABEL,
  Shares,
  Slot,
} from "@/src/types/PlanType";
import { localDateString } from "@/src/utils/date";
import { openRecipeInForum } from "@/src/utils/openRecipe";

type Seen = Record<Slot, number[]>;
type Mode = "day" | "single";
type Single = {
  recipe_id: number;
  recipe_name: string;
  calories: number;
  protein: number;
  meal_type?: string | null;
  preferences?: string[];
};

const cache: { key?: string; plan?: Plan; seen?: Seen } = {};
const EMPTY_SEEN: Seen = { breakfast: [], lunch: [], dinner: [] };

export default function PlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isServerHealthy } = useHealth();

  const cacheKey = `${user?.id}:${localDateString()}`;
  const hit = cache.key === cacheKey;

  const [plan, setPlan] = useState<Plan>(hit ? (cache.plan ?? {}) : {});
  const [seen, setSeen] = useState<Seen>(
    hit ? (cache.seen ?? EMPTY_SEEN) : EMPTY_SEEN,
  );
  const [mode, setMode] = useState<Mode>("day");
  const [singleSlot, setSingleSlot] = useState<Slot>("lunch");
  const [single, setSingle] = useState<Single | null>(null);
  const [singleSeen, setSingleSeen] = useState<number[]>([]);
  const [singleBusy, setSingleBusy] = useState(false);
  const [shares, setShares] = useState<Shares>(DEFAULT_SHARES);
  const [daily, setDaily] = useState({
    kcal: 2000,
    protein: 50,
    personal: false,
  });
  const [showTargets, setShowTargets] = useState(
    Object.keys(plan).length === 0,
  );
  const [stale, setStale] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rerolling, setRerolling] = useState<Slot | null>(null);

  useEffect(() => {
    cache.key = cacheKey;
    cache.plan = plan;
    cache.seen = seen;
  }, [cacheKey, plan, seen]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [p, t] = await Promise.all([
        supabase
          .from("personalData")
          .select("breakfast_pct, lunch_pct, dinner_pct")
          .eq("personal_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_daily_targets")
          .select("kcal, protein_g")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (p.error)
        console.error("Loading meal shares failed:", p.error.message);
      if (t.error)
        console.error("Loading daily target failed:", t.error.message);
      if (p.data) {
        setShares({
          breakfast: p.data.breakfast_pct ?? DEFAULT_SHARES.breakfast,
          lunch: p.data.lunch_pct ?? DEFAULT_SHARES.lunch,
          dinner: p.data.dinner_pct ?? DEFAULT_SHARES.dinner,
        });
      }
      if (t.data) {
        setDaily({
          kcal: t.data.kcal,
          protein: t.data.protein_g,
          personal: true,
        });
      }
    })();
  }, [user?.id]);

  const saveShares = async (next: Shares) => {
    if (!user?.id) return;
    const { error } = await supabase.from("personalData").upsert(
      {
        personal_id: user.id,
        breakfast_pct: next.breakfast,
        lunch_pct: next.lunch,
        dinner_pct: next.dinner,
      },
      { onConflict: "personal_id" },
    );
    if (error) {
      Alert.alert("Couldn't save your targets", error.message);
      return;
    }
    if (Object.keys(plan).length > 0) setStale(true);
  };

  const onGenerate = async () => {
    if (!user?.id || generating || !isServerHealthy) return;
    setGenerating(true);
    try {
      const next = await generatePlan(user.id);
      setPlan(next);
      setSeen({
        breakfast: next.breakfast ? [next.breakfast.recipe_id] : [],
        lunch: next.lunch ? [next.lunch.recipe_id] : [],
        dinner: next.dinner ? [next.dinner.recipe_id] : [],
      });
      setStale(false);
      setShowTargets(false);
      if (SLOTS.every((s) => !next[s])) {
        Alert.alert(
          "No plan yet",
          "We couldn't find recipes that fit. Try again later.",
        );
      }
    } catch (err: any) {
      Alert.alert("Couldn't build your plan", err.message);
    } finally {
      setGenerating(false);
    }
  };

  const onReroll = async (slot: Slot) => {
    if (!user?.id || rerolling || !isServerHealthy) return;
    setRerolling(slot);
    try {
      const current: Record<string, number> = {};
      SLOTS.forEach((s) => {
        const m = plan[s];
        if (m) current[s] = m.recipe_id;
      });
      const meal = await rerollSlot({
        userId: user.id,
        slot,
        current,
        seenIds: seen[slot],
      });
      if (!meal) {
        Alert.alert(
          "No other recipe fits",
          "You've seen everything that matches this meal.",
        );
        return;
      }
      setPlan((p) => ({ ...p, [slot]: meal }));
      setSeen((s) => ({ ...s, [slot]: [...s[slot], meal.recipe_id] }));
    } catch (err: any) {
      Alert.alert("Couldn't reroll", err.message);
    } finally {
      setRerolling(null);
    }
  };

  // Single meal mode: one suggestion for the chosen meal; "Another" gives a different one
  const onSuggestSingle = async (slot: Slot, reset: boolean) => {
    if (!user?.id || singleBusy || !isServerHealthy) return;
    setSingleBusy(true);
    try {
      const seenIds = reset ? [] : singleSeen;
      const meal = await anotherMeal({
        userId: user.id,
        mealType: slot,
        seenIds,
        preferences: [],
      });
      if (!meal) {
        Alert.alert(
          "No other recipe fits",
          "You've seen everything that matches this meal.",
        );
        return;
      }
      setSingle(meal as Single);
      setSingleSeen([...seenIds, Number(meal.recipe_id)]);
    } catch (err: any) {
      Alert.alert("Couldn't get a meal", err.message);
    } finally {
      setSingleBusy(false);
    }
  };

  const onPickSingleSlot = (slot: Slot) => {
    if (slot === singleSlot) return;
    setSingleSlot(slot);
    setSingle(null);
    setSingleSeen([]);
  };

  const onClear = (slot: Slot) => {
    setPlan((p) => {
      const { [slot]: _removed, ...rest } = p;
      return rest;
    });
  };

  const planned = SLOTS.reduce(
    (acc, s) => {
      const m = plan[s];
      return m
        ? {
            kcal: acc.kcal + m.calories,
            protein: acc.protein + m.protein,
            n: acc.n + 1,
          }
        : acc;
    },
    { kcal: 0, protein: 0, n: 0 },
  );
  const images = useRecipeImages([
    ...SLOTS.map((s) => plan[s]?.recipe_id).filter((n): n is number => !!n),
    ...(single ? [single.recipe_id] : []),
  ]);
  const kcalPct =
    daily.kcal > 0
      ? Math.min(100, Math.round((planned.kcal / daily.kcal) * 100))
      : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Today's plan</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowTargets((v) => !v)}
        >
          <Ionicons name="options-outline" size={22} color="#FF7A00" />
        </TouchableOpacity>
      </View>

      <HealthBanner />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.dailyLine}>
          Daily target {daily.kcal.toLocaleString()} kcal · {daily.protein} g
          protein
          {daily.personal
            ? ""
            : " (default — complete your profile for a personal target)"}
        </Text>

        {showTargets && (
          <MealShareSliders
            shares={shares}
            dailyKcal={daily.kcal}
            dailyProtein={daily.protein}
            onChange={setShares}
            onCommit={(next) => {
              setShares(next);
              saveShares(next);
            }}
          />
        )}

        {stale && (
          <Text style={styles.stale}>
            Targets changed. Generate again to update your plan.
          </Text>
        )}

        <View style={styles.modeRow}>
          {(["day", "single"] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnOn]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>
                {m === "day" ? "Day plan" : "Single meal"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === "single" ? (
          <>
            <View style={styles.modeRow}>
              {SLOTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, singleSlot === s && styles.chipOn]}
                  onPress={() => onPickSingleSlot(s)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      singleSlot === s && styles.chipTextOn,
                    ]}
                  >
                    {SLOT_LABEL[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!single ? (
              <TouchableOpacity
                style={[
                  styles.generateBtn,
                  (singleBusy || !isServerHealthy) && styles.dimmed,
                ]}
                onPress={() => onSuggestSingle(singleSlot, true)}
                disabled={singleBusy || !isServerHealthy}
              >
                {singleBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.generateText}>
                    Suggest a {SLOT_LABEL[singleSlot].toLowerCase()}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.card}>
                {!!images[single.recipe_id] && (
                  <Image
                    source={{ uri: images[single.recipe_id]! }}
                    style={styles.mealImage}
                  />
                )}
                <TouchableOpacity
                  style={styles.mealRow}
                  onPress={() => openRecipeInForum(router, single.recipe_id)}
                >
                  <Text style={styles.mealName}>{single.recipe_name}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
                </TouchableOpacity>
                <Text style={styles.mealNutrition}>
                  {Math.round(single.calories)} kcal ·{" "}
                  {Math.round(single.protein)} g protein
                </Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { flex: 1 },
                      (singleBusy || !isServerHealthy) && styles.dimmed,
                    ]}
                    onPress={() => onSuggestSingle(singleSlot, false)}
                    disabled={singleBusy || !isServerHealthy}
                  >
                    {singleBusy ? (
                      <ActivityIndicator size="small" color="#FF7A00" />
                    ) : (
                      <Text style={styles.actionText}>Another</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.generateBtn,
                (generating || !isServerHealthy) && styles.dimmed,
              ]}
              onPress={onGenerate}
              disabled={generating || !isServerHealthy}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.generateText}>
                  {planned.n > 0 ? "Generate a new plan" : "Generate plan"}
                </Text>
              )}
            </TouchableOpacity>

            {SLOTS.map((slot) => {
              const meal = plan[slot];
              return (
                <SlotCard
                  key={slot}
                  slot={slot}
                  pct={shares[slot]}
                  target={{
                    kcal: (daily.kcal * shares[slot]) / 100,
                    protein: (daily.protein * shares[slot]) / 100,
                  }}
                  meal={meal}
                  imageUri={meal ? images[meal.recipe_id] : null}
                  busy={rerolling === slot}
                  online={isServerHealthy}
                  onOpen={() =>
                    meal && openRecipeInForum(router, meal.recipe_id)
                  }
                  onReroll={() => onReroll(slot)}
                  onClear={() => onClear(slot)}
                />
              );
            })}

            {planned.n > 0 && (
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Planned</Text>
                  <Text style={styles.summaryValue}>
                    {Math.round(planned.kcal).toLocaleString()} /{" "}
                    {daily.kcal.toLocaleString()} kcal ·{" "}
                    {Math.round(planned.protein)} / {daily.protein} g protein
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${kcalPct}%` }]} />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

type CardProps = {
  slot: Slot;
  pct: number;
  target: { kcal: number; protein: number };
  meal?: PlanMeal;
  imageUri?: string | null;
  busy: boolean;
  online: boolean;
  onOpen: () => void;
  onReroll: () => void;
  onClear: () => void;
};

function SlotCard({
  slot,
  pct,
  target,
  meal,
  imageUri,
  busy,
  online,
  onOpen,
  onReroll,
  onClear,
}: CardProps) {
  const fit =
    meal && target.kcal > 0
      ? Math.round((meal.calories / target.kcal) * 100)
      : null;
  const fitOk = fit !== null && fit >= 85 && fit <= 115;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.slotName}>{SLOT_LABEL[slot]}</Text>
        <Text style={styles.slotTarget}>
          {pct === 0
            ? "Skipped"
            : `Target ${Math.round(target.kcal)} kcal · ${Math.round(target.protein)} g protein`}
        </Text>
      </View>

      {pct === 0 ? (
        <Text style={styles.empty}>Raise the slider to include this meal.</Text>
      ) : !meal ? (
        <Text style={styles.empty}>
          No recipe yet. Generate a plan to fill this meal.
        </Text>
      ) : (
        <>
          {!!imageUri && (
            <Image source={{ uri: imageUri }} style={styles.mealImage} />
          )}
          <TouchableOpacity style={styles.mealRow} onPress={onOpen}>
            <Text style={styles.mealName}>{meal.recipe_name}</Text>
            <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
          </TouchableOpacity>
          <Text style={styles.mealNutrition}>
            {Math.round(meal.calories)} kcal · {Math.round(meal.protein)} g
            protein
          </Text>
          {fit !== null && (
            <Text
              style={[styles.fit, { color: fitOk ? "#2E7D32" : "#E66E00" }]}
            >
              {fit}% of the meal target
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { flex: 1 },
                (busy || !online) && styles.dimmed,
              ]}
              onPress={onReroll}
              disabled={busy || !online}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FF7A00" />
              ) : (
                <Text style={styles.actionText}>Reroll</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onClear}>
              <Ionicons name="close" size={18} color="#FF7A00" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  content: { padding: 16, gap: 12 },
  dailyLine: { fontSize: 13, color: "#6C6C70" },
  stale: { fontSize: 13, color: "#E66E00" },
  generateBtn: {
    backgroundColor: "#FF7A00",
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  generateText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  dimmed: { opacity: 0.5 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
    gap: 8,
  },
  slotName: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  slotTarget: {
    fontSize: 12,
    color: "#6C6C70",
    flexShrink: 1,
    textAlign: "right",
  },
  empty: { fontSize: 13, color: "#8E8E93" },
  mealRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  mealName: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  mealNutrition: { fontSize: 13, color: "#6C6C70", marginTop: 2 },
  fit: { fontSize: 12, marginTop: 2 },
  mealImage: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#F0F0F0",
  },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FF7A00",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  modeBtnOn: { backgroundColor: "#FF7A00" },
  modeText: { color: "#FF7A00", fontWeight: "600", fontSize: 14 },
  modeTextOn: { color: "#FFFFFF" },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  chipOn: { borderColor: "#FF7A00", backgroundColor: "#FFF3E6" },
  chipText: { color: "#6C6C70", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#FF7A00" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    height: 38,
    minWidth: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FF7A00",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  actionText: { color: "#FF7A00", fontWeight: "600", fontSize: 14 },
  summary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, color: "#6C6C70" },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1C1C1E",
    flexShrink: 1,
    textAlign: "right",
  },
  barTrack: { height: 6, backgroundColor: "#F0F0F0", borderRadius: 3 },
  barFill: { height: 6, backgroundColor: "#FF7A00", borderRadius: 3 },
  summaryNote: { fontSize: 12, color: "#6C6C70", marginTop: 8 },
});
