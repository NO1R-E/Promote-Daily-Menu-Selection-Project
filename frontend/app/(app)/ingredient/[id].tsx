// Ingredient info page: names, status badge, nutrients per 100 g, tags and how much it is used.
// Everyone can open it (verified or not). Admins also get Edit / Edit & verify.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import IngredientForm from "@/components/forms/ingredientForm";
import {
  ORANGE,
  ORANGE_DARK,
  ORANGE_LIGHT,
  ORANGE_BORDER,
  CORE_NUTRIENT_NAMES,
  getNutrientLabel,
} from "@/components/forms/ingredientCommon";

type NutrientLine = { name: string; unit: string; amount: number };
type TagGroup = { group: string; order: number; tags: string[] };
type Info = {
  id: number;
  nameEn: string | null;
  nameTh: string | null;
  status: string | null;
  nutrients: NutrientLine[];
  tagGroups: TagGroup[];
  users: number;
  recipes: number;
};

const one = (v: any) => (Array.isArray(v) ? v[0] : v);
const fmt = (v: number) => String(Math.round(v * 100) / 100);

export default function IngredientInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ingredientId = Number(id);

  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "verify">("view");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ing, pop] = await Promise.all([
        supabase
          .from("ingredients")
          .select(
            "ingredient_id, norm_en, norm_th, status, ingredient_nutrients(amount, nutrients(nutrient_name, nutrient_unit)), ingredient_tags(tags(tag_name, tag_groups(group_name, sort_order)))",
          )
          .eq("ingredient_id", ingredientId)
          .maybeSingle(),
        supabase
          .from("ingredient_popularity")
          .select("users_count, recipes_count")
          .eq("ingredient_id", ingredientId)
          .maybeSingle(),
      ]);
      if (ing.error) throw ing.error;
      if (!ing.data) throw new Error("This ingredient no longer exists.");
      const d: any = ing.data;

      const nutrients: NutrientLine[] = (d.ingredient_nutrients ?? [])
        .map((r: any) => {
          const n = one(r.nutrients);
          return {
            name: String(n?.nutrient_name ?? ""),
            unit: String(n?.nutrient_unit ?? ""),
            amount: Number(r.amount) || 0,
          };
        })
        .filter((n: NutrientLine) => n.name)
        .sort((a: NutrientLine, b: NutrientLine) => {
          const order = CORE_NUTRIENT_NAMES as readonly string[];
          const ia = order.indexOf(a.name);
          const ib = order.indexOf(b.name);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        });

      const groups = new Map<string, TagGroup>();
      (d.ingredient_tags ?? []).forEach((r: any) => {
        const t = one(r.tags);
        const g = one(t?.tag_groups);
        if (!t?.tag_name) return;
        const key = String(g?.group_name ?? "Other");
        if (!groups.has(key))
          groups.set(key, { group: key, order: Number(g?.sort_order ?? 99), tags: [] });
        groups.get(key)!.tags.push(String(t.tag_name));
      });

      setInfo({
        id: ingredientId,
        nameEn: d.norm_en ?? null,
        nameTh: d.norm_th ?? null,
        status: d.status ?? null,
        nutrients,
        tagGroups: Array.from(groups.values()).sort((a, b) => a.order - b.order),
        users: Number(pop.data?.users_count) || 0,
        recipes: Number(pop.data?.recipes_count) || 0,
      });
    } catch (e: any) {
      console.log("Error loading ingredient:", e?.message || e);
      setError(e?.message || "Couldn't load this ingredient.");
    } finally {
      setLoading(false);
    }
  }, [ingredientId]);

  useEffect(() => {
    load();
  }, [load]);

  const verified = info?.status === "verified";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ingredient</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading && !info ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : error || !info ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "Couldn't load this ingredient."}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.link}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : mode !== "view" ? (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <IngredientForm
            mode="admin"
            editIngredientId={info.id}
            verifyOnSave={mode === "verify"}
            onCancel={() => setMode("view")}
            onSaved={() => {
              setMode("view");
              load();
            }}
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.nameRow}>
            <Text style={styles.name}>{info.nameEn || info.nameTh || "Unnamed"}</Text>
            {verified && (
              <Ionicons name="checkmark-circle" size={22} color="#34C759" style={{ marginLeft: 8 }} />
            )}
          </View>
          {!!info.nameEn && !!info.nameTh && <Text style={styles.subName}>{info.nameTh}</Text>}

          <View style={[styles.badge, verified ? styles.badgeOk : styles.badgeWarn]}>
            <Text style={[styles.badgeText, { color: verified ? "#1E7B34" : "#9A5B00" }]}>
              {verified ? "Verified" : "Unverified"}
            </Text>
          </View>
          {!verified && (
            <Text style={styles.warnText}>
              Added by a user and not yet checked by an admin. Nutrition, allergen and diet labels may
              be inaccurate.
            </Text>
          )}

          <Text style={styles.usage}>
            {info.users > 0
              ? `Used by ${info.users} ${info.users === 1 ? "user" : "users"} in ${info.recipes} ${
                  info.recipes === 1 ? "recipe" : "recipes"
                }`
              : "Not used in any recipe yet"}
          </Text>

          {isAdmin && (
            <View style={styles.adminRow}>
              <TouchableOpacity
                style={[styles.adminBtn, styles.adminBtnGhost]}
                onPress={() => setMode("edit")}
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={18} color={ORANGE_DARK} />
                <Text style={styles.adminBtnGhostText}>Edit</Text>
              </TouchableOpacity>
              {!verified && (
                <TouchableOpacity
                  style={styles.adminBtn}
                  onPress={() => setMode("verify")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color="#FFF" />
                  <Text style={styles.adminBtnText}>Edit & verify</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={styles.section}>Nutrients per 100 g</Text>
          {info.nutrients.length === 0 ? (
            <Text style={styles.muted}>No nutrient data</Text>
          ) : (
            <View style={styles.card}>
              {info.nutrients.map((n, i) => (
                <View
                  key={n.name}
                  style={[styles.nRow, i === info.nutrients.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <Text style={styles.nName}>{getNutrientLabel(n.name)}</Text>
                  <Text style={styles.nValue}>
                    {fmt(n.amount)} {n.unit}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.section}>Tags</Text>
          {info.tagGroups.length === 0 ? (
            <Text style={styles.muted}>No tags</Text>
          ) : (
            info.tagGroups.map((g) => (
              <View key={g.group} style={{ marginBottom: 12 }}>
                <Text style={styles.groupName}>{g.group}</Text>
                <View style={styles.chips}>
                  {g.tags.map((t) => (
                    <View key={t} style={styles.chip}>
                      <Text style={styles.chipText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#222" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#B00020", marginBottom: 10, textAlign: "center" },
  link: { color: ORANGE_DARK, fontWeight: "700" },
  body: { padding: 20 },

  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 22, fontWeight: "800", color: "#222", flexShrink: 1 },
  subName: { fontSize: 15, color: "#8E8E93", marginTop: 2 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 10,
  },
  badgeOk: { backgroundColor: "#E6F7EA" },
  badgeWarn: { backgroundColor: "#FFF3D6" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  warnText: { fontSize: 12, color: "#8E8E93", marginTop: 8, lineHeight: 17 },
  usage: { fontSize: 13, color: "#555", marginTop: 12 },

  adminRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  adminBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: ORANGE,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  adminBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  adminBtnGhost: { backgroundColor: ORANGE_LIGHT, borderWidth: 1.5, borderColor: ORANGE_BORDER },
  adminBtnGhostText: { color: ORANGE_DARK, fontWeight: "700", fontSize: 14 },

  section: { fontSize: 15, fontWeight: "700", color: "#222", marginTop: 22, marginBottom: 8 },
  muted: { fontSize: 13, color: "#8E8E93" },
  card: {
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#FAFAFA",
  },
  nRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#EEE",
  },
  nName: { fontSize: 14, color: "#3A3A3C" },
  nValue: { fontSize: 14, fontWeight: "600", color: "#222" },

  groupName: { fontSize: 12, fontWeight: "600", color: "#8E8E93", marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: ORANGE_LIGHT,
    borderWidth: 1,
    borderColor: ORANGE_BORDER,
  },
  chipText: { fontSize: 13, color: ORANGE_DARK, fontWeight: "600" },
});
