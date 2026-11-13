// src/components/forms/IngredientPickerSheet.tsx
//
// หน้าต่าง (bottom sheet) สำหรับเลือกวัตถุดิบตอนสร้างโพสต์สูตรอาหาร มี 2 แท็บ:
//   - "System"          : วัตถุดิบของระบบ (ingredients ที่ status = 'verified') ค้นด้วยชื่ออังกฤษ/ไทย
//   - "My ingredients"  : วัตถุดิบที่ผู้ใช้เพิ่มเอง (ingredients ที่ status = 'unverified' และ user_id = ตัวเอง)
//                         เลือก / เพิ่มใหม่ / ลบได้
//
// ทั้งสองแบบอยู่ในตาราง ingredients เดียวกัน id ที่ได้จึงเป็น ingredient_id เหมือนกัน
// หน้าที่เรียกใช้เป็นเจ้าของรายการที่เลือก (picked) ส่วนหน้าต่างนี้แค่แจ้งผ่าน onToggle ว่ากดเลือก/ยกเลิกตัวไหน

import { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import { UserIngredientForm } from "./UserIngredientForm";
import IngredientForm from "./ingredientForm";
import { ORANGE, ORANGE_DARK, ORANGE_SOFT, ORANGE_LIGHT, ORANGE_BORDER } from "./ingredientCommon";

// ===== ชนิดข้อมูลที่ใช้ร่วมกับหน้า create-post =====
export type IngredientSource = "system" | "user";

// วัตถุดิบที่ถูกเลือกไว้ในโพสต์ (id = ingredient_id ทั้งของระบบและของผู้ใช้)
export type PickedIngredient = {
  key: string; // "system-12" / "user-5" ใช้แยกที่มาบนหน้าจอ
  source: IngredientSource;
  id: number;
  name: string;
  weight_g: string;
};

export type PickableIngredient = { source: IngredientSource; id: number; name: string };

export const makeIngredientKey = (source: IngredientSource, id: number) => `${source}-${id}`;

// ชื่อที่แสดง: ใช้อังกฤษก่อน ถ้าไม่มีใช้ไทย (วัตถุดิบของผู้ใช้อาจมีชื่อภาษาเดียว)
const displayName = (en: string | null, th: string | null) => en || th || "";

// result row of the search_ingredients function: every ingredient (verified or not), most used first
type SystemItem = {
  ingredient_id: number;
  norm_en: string | null;
  norm_th: string | null;
  status: string | null;
  users_count: number | null;
};

type NutrientRow = { amount: number | string | null; nutrients: any };
type MyItem = {
  ingredient_id: number;
  status: string | null;
  norm_en: string | null;
  norm_th: string | null;
  ingredient_nutrients: NutrientRow[] | null;
};

// ดึงค่าสารอาหารหนึ่งตัว (ตามชื่อใน nutrients.nutrient_name) จากรายการวัตถุดิบของผู้ใช้
const getAmount = (item: MyItem, nutrientName: string): number | null => {
  for (const row of item.ingredient_nutrients || []) {
    const n = Array.isArray(row.nutrients) ? row.nutrients[0] : row.nutrients;
    if (n?.nutrient_name === nutrientName) {
      const v = Number(row.amount);
      return Number.isFinite(v) ? v : null;
    }
  }
  return null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  picked: PickedIngredient[];
  onToggle: (item: PickableIngredient) => void;
};

export default function IngredientPickerSheet({ visible, onClose, picked, onToggle }: Props) {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  // open the ingredient info page (close the sheet first, picked items stay in the parent form)
  const openInfo = (id: number) => {
    onClose();
    router.push(`/(app)/ingredient/${id}` as any);
  };

  // admin: id of the verified ingredient being edited (null = not editing)
  const [editId, setEditId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [tab, setTab] = useState<"system" | "mine">("system");

  // ----- แท็บ System -----
  const [sysQuery, setSysQuery] = useState("");
  const [sysResults, setSysResults] = useState<SystemItem[]>([]);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysError, setSysError] = useState(false);

  // ----- แท็บ My ingredients -----
  const [myMode, setMyMode] = useState<"list" | "form" | "edit">("list");
  const [myEditId, setMyEditId] = useState<number | null>(null);
  const [releasingId, setReleasingId] = useState<number | null>(null);
  // my ingredients used by a recipe that still has a visible post -> locked (no edit, no delete), only "remove from my list"
  const [usedIds, setUsedIds] = useState<Set<number>>(new Set());
  const [myItems, setMyItems] = useState<MyItem[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myQuery, setMyQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isPicked = (source: IngredientSource, id: number) =>
    picked.some((p) => p.key === makeIngredientKey(source, id));

  // ===== โหลดวัตถุดิบของตัวเอง =====
  const loadMine = useCallback(async () => {
    if (!user) return;
    try {
      setMyLoading(true);
      const { data, error } = await supabase
        .from("ingredients")
        .select("ingredient_id, status, norm_en, norm_th, ingredient_nutrients(amount, nutrients(nutrient_name))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const { data: used } = await supabase.rpc("my_ingredients_in_live_use");
      setUsedIds(new Set(((used as (number | string)[] | null) ?? []).map(Number)));
      setMyItems((data as unknown as MyItem[]) || []);
    } catch (error: any) {
      console.error("Error loading user ingredients:", error?.message || error);
      Alert.alert("Error", "Failed to load your ingredients");
    } finally {
      setMyLoading(false);
    }
  }, [user]);

  // เปิดหน้าต่างทีไร เริ่มที่แท็บ System และโหลดรายการของตัวเองไว้ล่วงหน้า (ใช้แสดงจำนวนบนแท็บ)
  useEffect(() => {
    if (visible) {
      setTab("system");
      setMyMode("list");
      setEditId(null);
      setSysQuery("");
      setMyQuery("");
      loadMine();
    }
  }, [visible, loadMine]);

  // ===== ค้นหาวัตถุดิบของระบบ (หน่วงการพิมพ์ 300ms) =====
  useEffect(() => {
    if (!visible || tab !== "system") return;

    const timer = setTimeout(async () => {
      setSysLoading(true);
      try {
        // all ingredients (verified or not), ordered by how many different users use them
        const { data, error } = await supabase.rpc("search_ingredients", {
          p_query: sysQuery.trim(),
          p_limit: 30,
          p_offset: 0,
        });
        if (error) throw error;

        setSysError(false);
        setSysResults((data as SystemItem[]) || []);
      } catch (error: any) {
        console.error("Error searching ingredients:", error?.message || error);
        setSysError(true);
      } finally {
        setSysLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [sysQuery, tab, visible, reloadKey]);

  // ===== ลบวัตถุดิบของตัวเอง (ผ่านฟังก์ชัน delete_user_ingredient) =====
  const handleDelete = async (item: MyItem) => {
    if (!user) return;
    const name = displayName(item.norm_en, item.norm_th);
    if (item.status === "verified") return; // system ingredients are never deleted
    try {
      setDeletingId(item.ingredient_id);

      const { error } = await supabase.rpc("delete_user_ingredient", {
        p_ingredient_id: item.ingredient_id,
      });
      if (error) throw error;

      // ถ้าวัตถุดิบนี้ถูกเลือกอยู่ในโพสต์ที่กำลังเขียน ให้เอาออกด้วย
      if (isPicked("user", item.ingredient_id)) {
        onToggle({ source: "user", id: item.ingredient_id, name });
      }
      setMyItems((prev) => prev.filter((i) => i.ingredient_id !== item.ingredient_id));
    } catch (error: any) {
      console.error("Error deleting user ingredient:", error?.message || error);
      if (String(error?.message || "").includes("INGREDIENT_IN_USE")) {
        // ถูกใช้อยู่ในสูตรของโพสต์ จึงลบไม่ได้ (ตามกติกา: ต้องลบโพสต์ที่ใช้ก่อน)
        Alert.alert(
          "Can't delete",
          "This ingredient is used in a recipe, so it can't be deleted or edited. You can remove it from your list instead; it stays in the recipes that use it."
        );
        loadMine();
      } else {
        Alert.alert("Error", "Failed to delete ingredient");
      }
    } finally {
      setDeletingId(null);
    }
  };

  // used ingredient: give up ownership (user_id -> null). It stays in the recipes and in the ingredient list.
  const handleRelease = async (item: MyItem) => {
    if (!user) return;
    try {
      setReleasingId(item.ingredient_id);
      const { error } = await supabase.rpc("release_my_ingredient", {
        p_ingredient_id: item.ingredient_id,
      });
      if (error) throw error;
      setMyItems((prev) => prev.filter((i) => i.ingredient_id !== item.ingredient_id));
    } catch (error: any) {
      console.log("Error releasing ingredient:", error?.message || error);
      if (String(error?.message || "").includes("NOT_IN_USE")) {
        Alert.alert("Not needed", "No recipe uses this ingredient any more. You can delete it instead.");
        loadMine();
      } else {
        Alert.alert("Error", "Failed to remove ingredient from your list");
      }
    } finally {
      setReleasingId(null);
    }
  };

  const confirmRelease = (item: MyItem) => {
    Alert.alert(
      "Remove from my list",
      `"${displayName(item.norm_en, item.norm_th)}" is used in recipes, so it stays there and in the ingredient list. It will no longer be yours: you won't be able to edit or delete it.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => handleRelease(item) },
      ]
    );
  };

  const confirmDelete = (item: MyItem) => {
    Alert.alert(
      "Delete ingredient",
      `Delete "${displayName(item.norm_en, item.norm_th)}"? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDelete(item) },
      ]
    );
  };

  const fmt = (v: number | null) => (v === null || v === undefined ? "-" : String(Math.round(v * 10) / 10));

  const filteredMine = myItems.filter((i) =>
    displayName(i.norm_en, i.norm_th).toLowerCase().includes(myQuery.trim().toLowerCase())
  );

  // ปุ่มกลมท้ายแถว: ยังไม่เลือก = เครื่องหมาย +, เลือกแล้ว = เครื่องหมายถูก
  const renderToggleMark = (on: boolean) => (
    <View style={[styles.mark, on && styles.markOn]}>
      <Ionicons name={on ? "checkmark" : "add"} size={16} color={on ? "#FFF" : ORANGE_DARK} />
    </View>
  );

  const editing = editId !== null;
  const showFooter = !editing && !(tab === "mine" && myMode !== "list");

  const renderEditBtn = (id: number) =>
    isAdmin ? (
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => setEditId(id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="create-outline" size={20} color={ORANGE_DARK} />
      </TouchableOpacity>
    ) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* แตะพื้นที่มืดด้านบนเพื่อปิด */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.handle} />

          {/* หัวหน้าต่าง */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Add ingredient</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          {/* แท็บเลือกแหล่งวัตถุดิบ */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === "system" && styles.tabBtnActive]}
              activeOpacity={0.8}
              onPress={() => setTab("system")}
            >
              <Text style={[styles.tabText, tab === "system" && styles.tabTextActive]}>All ingredients</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === "mine" && styles.tabBtnActive]}
              activeOpacity={0.8}
              onPress={() => setTab("mine")}
            >
              <Text style={[styles.tabText, tab === "mine" && styles.tabTextActive]}>
                My ingredients ({myItems.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* ===== เนื้อหาแท็บ System ===== */}
          {editing && (
            <ScrollView
              style={styles.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <IngredientForm
                mode="admin"
                editIngredientId={editId as number}
                onCancel={() => setEditId(null)}
                onSaved={() => {
                  setEditId(null);
                  setReloadKey((k) => k + 1);
                  loadMine();
                }}
              />
            </ScrollView>
          )}

          {!editing && tab === "system" && (
            <View style={styles.body}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#8E8E93" />
                <TextInput
                  style={styles.searchInput}
                  value={sysQuery}
                  onChangeText={setSysQuery}
                  placeholder="Search ingredient (English / ไทย)"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                />
                {sysLoading && <ActivityIndicator size="small" color={ORANGE} />}
              </View>

              {sysError && <Text style={styles.errorText}>Couldn't search ingredients. Try again.</Text>}

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {sysResults.length === 0 && !sysLoading && !sysError ? (
                  <Text style={styles.emptyText}>No ingredients found</Text>
                ) : (
                  sysResults.map((r) => {
                    const verified = r.status === "verified";
                    const src: IngredientSource = verified ? "system" : "user";
                    const on = isPicked(src, r.ingredient_id);
                    const name = displayName(r.norm_en, r.norm_th);
                    // แสดงอีกภาษาเป็นบรรทัดรอง (ถ้ามีทั้งสองภาษา)
                    const sub = r.norm_en && r.norm_th ? r.norm_th : null;
                    const used = Number(r.users_count) || 0;
                    return (
                      <TouchableOpacity
                        key={r.ingredient_id}
                        style={[styles.row, on && styles.rowOn]}
                        activeOpacity={0.8}
                        onPress={() => onToggle({ source: src, id: r.ingredient_id, name })}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={styles.nameRow}>
                            <Text style={[styles.rowName, { flexShrink: 1 }]} numberOfLines={1}>
                              {name}
                            </Text>
                            {verified && (
                              <Ionicons name="checkmark-circle" size={16} color="#34C759" style={{ marginLeft: 6 }} />
                            )}
                          </View>
                          {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
                          <Text style={styles.rowSub}>
                            {used > 0 ? `Used by ${used} ${used === 1 ? "user" : "users"}` : "Not used yet"}
                            {verified ? "" : " · Unverified"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => openInfo(r.ingredient_id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="information-circle-outline" size={20} color="#8E8E93" />
                        </TouchableOpacity>
                        {renderEditBtn(r.ingredient_id)}
                        {renderToggleMark(on)}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {/* ===== เนื้อหาแท็บ My ingredients ===== */}
          {!editing && tab === "mine" && myMode === "list" && (
            <View style={styles.body}>
              <View style={styles.mineTopRow}>
                <View style={[styles.searchBox, { flex: 1, marginBottom: 0 }]}>
                  <Ionicons name="search" size={18} color="#8E8E93" />
                  <TextInput
                    style={styles.searchInput}
                    value={myQuery}
                    onChangeText={setMyQuery}
                    placeholder="Search my ingredients"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity style={styles.newBtn} activeOpacity={0.85} onPress={() => setMyMode("form")}>
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.newBtnText}>New</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ marginTop: 12 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {myLoading ? (
                  <View style={styles.centerBlock}>
                    <ActivityIndicator size="small" color={ORANGE} />
                  </View>
                ) : myItems.length === 0 ? (
                  <View style={styles.centerBlock}>
                    <Ionicons name="nutrition-outline" size={32} color={ORANGE_BORDER} />
                    <Text style={styles.emptyText}>You haven't added any ingredients yet</Text>
                    <Text style={styles.emptyHint}>Tap "New" to add your own ingredient</Text>
                  </View>
                ) : filteredMine.length === 0 ? (
                  <Text style={styles.emptyText}>No matching ingredients</Text>
                ) : (
                  filteredMine.map((it) => {
                    const verified = it.status === "verified";
                    // verified rows behave exactly like System-tab rows
                    const src: IngredientSource = verified ? "system" : "user";
                    const on = isPicked(src, it.ingredient_id);
                    const name = displayName(it.norm_en, it.norm_th);
                    return (
                      <TouchableOpacity
                        key={it.ingredient_id}
                        style={[styles.row, on && styles.rowOn]}
                        activeOpacity={0.8}
                        onPress={() => onToggle({ source: src, id: it.ingredient_id, name })}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName}>{name}</Text>
                          <Text style={styles.rowSub}>
                            {fmt(getAmount(it, "energy"))} kcal · P {fmt(getAmount(it, "protein"))}g · C{" "}
                            {fmt(getAmount(it, "carbohydrate"))}g · F {fmt(getAmount(it, "tot_fat"))}g
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => openInfo(it.ingredient_id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="information-circle-outline" size={20} color="#8E8E93" />
                        </TouchableOpacity>
                        {verified ? (
                          renderEditBtn(it.ingredient_id)
                        ) : usedIds.has(it.ingredient_id) ? (
                          // used by a recipe: locked, the owner can only give it up
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => confirmRelease(it)}
                            disabled={releasingId !== null}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            {releasingId === it.ingredient_id ? (
                              <ActivityIndicator size="small" color="#FF3B30" />
                            ) : (
                              <Ionicons name="remove-circle-outline" size={20} color="#FF3B30" />
                            )}
                          </TouchableOpacity>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => {
                                setMyEditId(it.ingredient_id);
                                setMyMode("edit");
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="create-outline" size={20} color={ORANGE_DARK} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => confirmDelete(it)}
                              disabled={deletingId !== null}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {deletingId === it.ingredient_id ? (
                                <ActivityIndicator size="small" color="#FF3B30" />
                              ) : (
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                              )}
                            </TouchableOpacity>
                          </>
                        )}

                        {renderToggleMark(on)}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {/* ===== ฟอร์มเพิ่มวัตถุดิบของตัวเอง ===== */}
          {!editing && tab === "mine" && myMode === "form" && (
            <ScrollView
              style={styles.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <UserIngredientForm
                onCancel={() => setMyMode("list")}
                onSaved={() => {
                  setMyMode("list");
                  loadMine();
                }}
              />
            </ScrollView>
          )}

          {/* owner edit of an unverified ingredient that no recipe uses yet */}
          {!editing && tab === "mine" && myMode === "edit" && myEditId !== null && (
            <ScrollView
              style={styles.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <IngredientForm
                mode="user"
                editIngredientId={myEditId}
                onCancel={() => {
                  setMyMode("list");
                  setMyEditId(null);
                }}
                onSaved={() => {
                  setMyMode("list");
                  setMyEditId(null);
                  loadMine();
                }}
              />
            </ScrollView>
          )}

          {/* ปุ่มเสร็จสิ้น */}
          {showFooter && (
            <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.doneBtnText}>
                {picked.length > 0 ? `Done · ${picked.length} selected` : "Done"}
              </Text>
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    height: "82%",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D1D6", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 18, fontWeight: "bold", color: ORANGE_DARK },

  tabs: { flexDirection: "row", backgroundColor: ORANGE_LIGHT, borderRadius: 12, padding: 4, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabBtnActive: { backgroundColor: ORANGE },
  tabText: { fontSize: 14, fontWeight: "600", color: ORANGE_DARK },
  tabTextActive: { color: "#FFF" },

  body: { flex: 1 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F8F9FA",
    marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: "#333" },
  errorText: { color: "#B00020", marginBottom: 8, fontSize: 13 },

  mineTopRow: { flexDirection: "row", alignItems: "center" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    paddingHorizontal: 14,
    marginLeft: 10,
    borderRadius: 12,
    backgroundColor: ORANGE,
  },
  newBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14, marginLeft: 4 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    padding: 12,
    marginBottom: 10,
  },
  rowOn: { backgroundColor: ORANGE_SOFT, borderColor: ORANGE_BORDER },
  nameRow: { flexDirection: "row", alignItems: "center" },
  rowName: { fontSize: 15, fontWeight: "600", color: "#333" },
  rowSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },

  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 10,
    backgroundColor: ORANGE_SOFT,
    justifyContent: "center",
    alignItems: "center",
  },
  markOn: { backgroundColor: ORANGE },
  deleteBtn: { marginLeft: 8, padding: 4, minWidth: 28, alignItems: "center" },

  centerBlock: { paddingVertical: 28, alignItems: "center" },
  emptyText: { textAlign: "center", marginTop: 12, fontSize: 13, color: "#8E8E93" },
  emptyHint: { textAlign: "center", marginTop: 4, fontSize: 12, color: "#B0B0B5" },

  doneBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: ORANGE,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});
