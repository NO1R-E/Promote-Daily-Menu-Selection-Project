import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { HealthBanner } from "@/components/HealthBanner";
import MealShareSliders from "@/components/MealShareSliders";
import { generatePlan, rerollSlot } from "@/src/api/plan";
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
type Ate = Partial<Record<Slot, string>>;


const cache: { key?: string; plan?: Plan; seen?: Seen; ate?: Ate } = {};
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
  const [ate, setAte] = useState<Ate>(hit ? (cache.ate ?? {}) : {});
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
    cache.ate = ate;
  }, [cacheKey, plan, seen, ate]);

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
      setAte({});
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

  const onAte = async (slot: Slot) => {
    const meal = plan[slot];
    if (!meal || !user?.id) return;
    const { data, error } = await supabase
      .from("record_item")
      .insert({
        user_id: user.id,
        recipe_id: meal.recipe_id,
        meal_type: slot,
        record_date: localDateString(),
      })
      .select("record_item_id")
      .single();
    if (error) {
      Alert.alert("Couldn't save this meal", error.message);
      return;
    }
    setAte((a) => ({ ...a, [slot]: data.record_item_id }));
  };

  const onUndo = async (slot: Slot) => {
    const id = ate[slot];
    if (!id) return;
    const { error } = await supabase
      .from("record_item")
      .delete()
      .eq("record_item_id", id);
    if (error) {
      Alert.alert("Couldn't undo", error.message);
      return;
    }
    setAte((a) => {
      const { [slot]: _removed, ...rest } = a;
      return rest;
    });
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
  const eatenCount = SLOTS.filter((s) => plan[s] && ate[s]).length;
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
          <Ionicons name="options-outline" size={22} color="#007AFF" />
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
              eatenId={ate[slot]}
              busy={rerolling === slot}
              online={isServerHealthy}
              onOpen={() => meal && openRecipeInForum(router, meal.recipe_id)}
              onReroll={() => onReroll(slot)}
              onAte={() => onAte(slot)}
              onUndo={() => onUndo(slot)}
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
            <Text style={styles.summaryNote}>
              {eatenCount} of {planned.n} planned meals eaten
            </Text>
          </View>
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
  eatenId?: string;
  busy: boolean;
  online: boolean;
  onOpen: () => void;
  onReroll: () => void;
  onAte: () => void;
  onUndo: () => void;
  onClear: () => void;
};

function SlotCard({
  slot,
  pct,
  target,
  meal,
  eatenId,
  busy,
  online,
  onOpen,
  onReroll,
  onAte,
  onUndo,
  onClear,
}: CardProps) {
  const eaten = !!eatenId;
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
          <TouchableOpacity style={styles.mealRow} onPress={onOpen}>
            <Text style={styles.mealName}>{meal.recipe_name}</Text>
            {eaten ? (
              <View style={styles.eatenBadge}>
                <Text style={styles.eatenText}>Eaten</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
            )}
          </TouchableOpacity>
          <Text style={styles.mealNutrition}>
            {Math.round(meal.calories)} kcal · {Math.round(meal.protein)} g
            protein
          </Text>
          {fit !== null && (
            <Text
              style={[styles.fit, { color: fitOk ? "#2E7D32" : "#B26A00" }]}
            >
              {fit}% of the meal target
            </Text>
          )}

          <View style={styles.actions}>
            {eaten ? (
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1 }]}
                onPress={onUndo}
              >
                <Text style={styles.actionText}>Undo</Text>
              </TouchableOpacity>
            ) : (
              <>
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
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Text style={styles.actionText}>Reroll</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 1 }]}
                  onPress={onAte}
                >
                  <Text style={styles.actionText}>Ate it</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={onClear}>
                  <Ionicons name="close" size={18} color="#007AFF" />
                </TouchableOpacity>
              </>
            )}
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
  stale: { fontSize: 13, color: "#B26A00" },
  generateBtn: {
    backgroundColor: "#007AFF",
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
  eatenBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  eatenText: { fontSize: 11, fontWeight: "600", color: "#2E7D32" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    height: 38,
    minWidth: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  actionText: { color: "#007AFF", fontWeight: "600", fontSize: 14 },
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
  barFill: { height: 6, backgroundColor: "#007AFF", borderRadius: 3 },
  summaryNote: { fontSize: 12, color: "#6C6C70", marginTop: 8 },
});
