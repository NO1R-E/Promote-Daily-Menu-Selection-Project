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
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import { UserIngredientForm } from "./UserIngredientForm";
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

type SystemItem = { ingredient_id: number; norm_en: string | null; norm_th: string | null };

type NutrientRow = { amount: number | string | null; nutrients: any };
type MyItem = {
  ingredient_id: number;
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
  const { user } = useAuth();

  const [tab, setTab] = useState<"system" | "mine">("system");

  // ----- แท็บ System -----
  const [sysQuery, setSysQuery] = useState("");
  const [sysResults, setSysResults] = useState<SystemItem[]>([]);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysError, setSysError] = useState(false);

  // ----- แท็บ My ingredients -----
  const [myMode, setMyMode] = useState<"list" | "form">("list");
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
        .select("ingredient_id, norm_en, norm_th, ingredient_nutrients(amount, nutrients(nutrient_name))")
        .eq("status", "unverified")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
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
        let request = supabase
          .from("ingredients")
          .select("ingredient_id, norm_en, norm_th")
          .eq("status", "verified") // ไม่ให้วัตถุดิบที่ยังไม่ยืนยันของผู้ใช้คนอื่นโผล่ในแท็บนี้
          .order("ingredient_id", { ascending: true })
          .limit(30);

        // ตัดอักขระที่ทำให้ตัวกรอง or() พัง (, ( ) % _ \) ออกจากคำค้นก่อน
        const q = sysQuery.trim().replace(/[,()%_\\]/g, " ").trim();
        if (q) {
          request = request.or(`norm_en.ilike.%${q}%,norm_th.ilike.%${q}%`);
        }

        const { data, error } = await request;
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
  }, [sysQuery, tab, visible]);

  // ===== ลบวัตถุดิบของตัวเอง (ผ่านฟังก์ชัน delete_user_ingredient) =====
  const handleDelete = async (item: MyItem) => {
    if (!user) return;
    const name = displayName(item.norm_en, item.norm_th);
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
          "This ingredient is used in a recipe post. Delete that post first, then try again."
        );
      } else {
        Alert.alert("Error", "Failed to delete ingredient");
      }
    } finally {
      setDeletingId(null);
    }
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

  const showFooter = !(tab === "mine" && myMode === "form");

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
              <Text style={[styles.tabText, tab === "system" && styles.tabTextActive]}>System</Text>
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
          {tab === "system" && (
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
                    const on = isPicked("system", r.ingredient_id);
                    const name = displayName(r.norm_en, r.norm_th);
                    // แสดงอีกภาษาเป็นบรรทัดรอง (ถ้ามีทั้งสองภาษา)
                    const sub = r.norm_en && r.norm_th ? r.norm_th : null;
                    return (
                      <TouchableOpacity
                        key={r.ingredient_id}
                        style={[styles.row, on && styles.rowOn]}
                        activeOpacity={0.8}
                        onPress={() => onToggle({ source: "system", id: r.ingredient_id, name })}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName}>{name}</Text>
                          {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
                        </View>
                        {renderToggleMark(on)}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {/* ===== เนื้อหาแท็บ My ingredients ===== */}
          {tab === "mine" && myMode === "list" && (
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
                    const on = isPicked("user", it.ingredient_id);
                    const name = displayName(it.norm_en, it.norm_th);
                    return (
                      <TouchableOpacity
                        key={it.ingredient_id}
                        style={[styles.row, on && styles.rowOn]}
                        activeOpacity={0.8}
                        onPress={() => onToggle({ source: "user", id: it.ingredient_id, name })}
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

                        {renderToggleMark(on)}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {/* ===== ฟอร์มเพิ่มวัตถุดิบของตัวเอง ===== */}
          {tab === "mine" && myMode === "form" && (
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
