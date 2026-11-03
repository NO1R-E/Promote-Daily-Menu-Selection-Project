// src/components/forms/IngredientForm.tsx
//
// ฟอร์มเพิ่มวัตถุดิบ ใช้ร่วมกันทั้งฝั่งผู้ใช้และแอดมิน (เรียกฟังก์ชัน create_ingredient ตัวเดียวกัน)
//   mode="user"  : ผู้ใช้กรอกชื่อเดียว (ระบบจัดลงช่องไทย/อังกฤษให้เอง) -> status 'unverified' (source 'user')
//   mode="admin" : แอดมินกรอกชื่ออังกฤษ/ไทย -> status 'verified' (source 'admin')
// ฟังก์ชันฝั่งฐานข้อมูลตัดสินสถานะจากบทบาทของผู้เรียกเอง ฟอร์มไม่ได้เป็นตัวกำหนด
//
// สารอาหาร: ผู้ใช้เห็น 7 ตัวหลักก่อน / แอดมินเห็น 13 ตัว ที่เหลือกด "Add more nutrients" เลือกได้ทีละหลายตัว
// แท็ก: แสดงเป็นกลุ่มที่กดเปิด/ปิดได้ (IngredientTagPicker)
// ไม่ต้องกรอกครบ ต้องมีชื่อ และสารอาหารอย่างน้อย 1 ค่า ช่องที่เว้นว่างจะไม่ถูกบันทึก
//
// ฟอร์มนี้ไม่มี ScrollView ในตัว วางในหน้าที่มี ScrollView อยู่แล้วได้เลย
// ค่าสารอาหารทุกตัวเป็นค่าต่อ 100 กรัม ดึงรายการและหน่วยจากตาราง nutrients

import { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import IngredientTagPicker from "./IngredientTagPicker";
import {
  ORANGE,
  ORANGE_DARK,
  ORANGE_SOFT,
  ORANGE_LIGHT,
  ORANGE_BORDER,
  CORE_NUTRIENT_NAMES,
  USER_CORE_NUTRIENT_NAMES,
  USER_REQUIRED_NUTRIENT_NAMES,
  CUISINE_GROUP_ID,
  sanitizeNumber,
  getNutrientLabel,
} from "./ingredientCommon";

type Nutrient = {
  nutrient_id: number;
  nutrient_name: string;
  nutrient_unit: string | null;
};

export type IngredientFormProps = {
  mode: "user" | "admin";
  title?: string; // ส่ง "" เพื่อซ่อนหัวข้อ
  submitLabel?: string;
  onSaved?: (ingredientId: number) => void;
  onCancel?: () => void;
};

// ข้อความ error ที่ฟังก์ชัน create_ingredient ส่งมา -> ข้อความที่แสดงให้ผู้ใช้
const ERROR_MESSAGES: Record<string, string> = {
  INGREDIENT_EXISTS_SYSTEM: "This ingredient already exists in the system. Please select it from the System tab instead.",
  INGREDIENT_EXISTS_MINE: "You already added an ingredient with this name.",
  LIMIT_REACHED: "You've reached the maximum number of custom ingredients.",
  NAME_REQUIRED: "Please enter an ingredient name.",
  NAME_TOO_LONG: "The ingredient name is too long.",
  NUTRIENT_REQUIRED: "Please enter at least one nutrient value.",
  NUTRIENT_INVALID: "Some nutrient values are invalid.",
  NUTRIENT_OUT_OF_RANGE: "Some nutrient values look unrealistic for 100 g. Please check them.",
  TAG_INVALID: "Some selected tags are not allowed.",
  NOT_AUTHENTICATED: "Please log in again.",
  CALORIES_REQUIRED: "Please enter Calories.",
};

const getErrorMessage = (error: any): string => {
  const text: string = error?.message || "";
  const code = Object.keys(ERROR_MESSAGES).find((k) => text.includes(k));
  return code ? ERROR_MESSAGES[code] : "Failed to add ingredient";
};

export default function IngredientForm({
  mode,
  title,
  submitLabel = "Save",
  onSaved,
  onCancel,
}: IngredientFormProps) {
  const isAdmin = mode === "admin";
  const heading = title ?? (isAdmin ? "Add Ingredient (Admin)" : "Add Ingredient");

  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [loadingNutrients, setLoadingNutrients] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [nameEn, setNameEn] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // สารอาหารเพิ่มเติม: ที่เลือกมาแสดงบนฟอร์มแล้ว / แผงเลือก / รายการที่ติ๊กไว้ในแผง (ยังไม่กดเพิ่ม)
  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [showExtraPanel, setShowExtraPanel] = useState(false);
  const [extraQuery, setExtraQuery] = useState("");
  const [pendingIds, setPendingIds] = useState<number[]>([]);

  const loadNutrients = async () => {
    setLoadingNutrients(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("nutrients")
      .select("nutrient_id, nutrient_name, nutrient_unit")
      .order("nutrient_id", { ascending: true });

    if (error) {
      console.error("Error loading nutrients:", error);
      setLoadError(true);
    } else {
      setNutrients((data as Nutrient[]) || []);
    }
    setLoadingNutrients(false);
  };

  useEffect(() => {
    loadNutrients();
  }, []);

  // สารอาหารหลัก เรียงตาม CORE_NUTRIENT_NAMES
  // (ถ้าชื่อในตารางไม่ตรงกับรายการหลักเลยสักตัว ให้แสดงทั้งหมดเป็นรายการหลัก ฟอร์มจะได้ยังใช้งานได้)
  // ผู้ใช้เห็น 7 ตัวหลัก (USER_CORE_NUTRIENT_NAMES) แอดมินเห็น 13 ตัว (CORE_NUTRIENT_NAMES)
  const coreNames = isAdmin ? CORE_NUTRIENT_NAMES : USER_CORE_NUTRIENT_NAMES;
  const coreList = useMemo(() => {
    const byName = new Map(nutrients.map((n) => [n.nutrient_name, n]));
    const list = coreNames.map((name) => byName.get(name)).filter(Boolean) as Nutrient[];
    return list.length > 0 ? list : nutrients;
  }, [nutrients, isAdmin]);

  // สารอาหารที่เหลือทั้งหมด (ยังไม่ใช่ตัวหลัก)
  const extraPool = useMemo(() => {
    const coreIds = new Set(coreList.map((n) => n.nutrient_id));
    return nutrients.filter((n) => !coreIds.has(n.nutrient_id));
  }, [nutrients, coreList]);

  // ที่เพิ่มมาแสดงบนฟอร์มแล้ว (เรียงตามลำดับที่เพิ่ม)
  const extraList = extraIds
    .map((id) => nutrients.find((n) => n.nutrient_id === id))
    .filter(Boolean) as Nutrient[];

  // ที่ยังเลือกเพิ่มได้ + กรองตามช่องค้นหา
  const addablePool = extraPool.filter((n) => !extraIds.includes(n.nutrient_id));
  const filteredPool = addablePool.filter((n) =>
    getNutrientLabel(n.nutrient_name).toLowerCase().includes(extraQuery.trim().toLowerCase())
  );

  const handleChangeValue = (nutrientId: number, text: string) => {
    setValues((prev) => ({ ...prev, [nutrientId]: sanitizeNumber(text) }));
  };

  const togglePending = (nutrientId: number) => {
    setPendingIds((prev) =>
      prev.includes(nutrientId) ? prev.filter((id) => id !== nutrientId) : [...prev, nutrientId]
    );
  };

  // เพิ่มสารอาหารที่ติ๊กไว้ทั้งหมดลงฟอร์มในครั้งเดียว
  const confirmAddExtra = () => {
    if (pendingIds.length === 0) return;
    setExtraIds((prev) => [...prev, ...pendingIds.filter((id) => !prev.includes(id))]);
    setPendingIds([]);
    setExtraQuery("");
    setShowExtraPanel(false);
  };

  // เอาสารอาหารเพิ่มเติมออกจากฟอร์ม (ล้างค่าที่กรอกไว้ด้วย)
  const removeExtra = (nutrientId: number) => {
    setExtraIds((prev) => prev.filter((id) => id !== nutrientId));
    setValues((prev) => {
      const next = { ...prev };
      delete next[nutrientId];
      return next;
    });
  };

  const handleSave = async () => {
    const en = nameEn.trim();
    const th = nameTh.trim();
    if (!en && !th) {
      Alert.alert("Warning", "Please enter an ingredient name");
      return;
    }
    // ตรวจช่องที่บังคับ (เฉพาะผู้ใช้ทั่วไป) ต้องมีค่า แต่ 0 ผ่าน
    if (!isAdmin) {
      for (const name of USER_REQUIRED_NUTRIENT_NAMES) {
        const n = nutrients.find((x) => x.nutrient_name === name);
        if (n && (values[n.nutrient_id] ?? "").trim() === "") {
          Alert.alert("Warning", `Please enter ${getNutrientLabel(name)}`);
          return;
        }
      }
    }

    // รวมเฉพาะสารอาหารที่แสดงบนฟอร์มและกรอกค่าไว้ (ช่องว่างข้าม)
    const rows: { nutrient_id: number; amount: number }[] = [];
    for (const n of [...coreList, ...extraList]) {
      const raw = (values[n.nutrient_id] ?? "").trim();
      if (raw === "") continue;

      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        Alert.alert("Warning", `Invalid value for ${getNutrientLabel(n.nutrient_name)}`);
        return;
      }
      rows.push({ nutrient_id: n.nutrient_id, amount });
    }

    if (rows.length === 0) {
      Alert.alert("Warning", "Please enter at least one nutrient value");
      return;
    }

    try {
      setSaving(true);

      // ฟังก์ชันเดียว: ตรวจชื่อซ้ำ/ค่าสารอาหาร, insert 3 ตาราง (ingredients, ingredient_nutrients, ingredient_tags)
      // ในครั้งเดียว และเช็กเงื่อนไขเลื่อนระดับ (ผู้ใช้ 5 คนขึ้นไปตั้งชื่อเดียวกัน)
      const { data, error } = await supabase.rpc("create_ingredient", {
        p_name_en: en || null,
        p_name_th: th || null,
        p_nutrients: rows,
        p_tag_ids: tagIds,
      });

      if (error) throw error;

      setNameEn("");
      setNameTh("");
      setValues({});
      setTagIds([]);
      setExtraIds([]);
      setPendingIds([]);
      setShowExtraPanel(false);
      onSaved?.(Number(data));
      if (isAdmin) Alert.alert("Success", "Ingredient added successfully");
    } catch (error: any) {
      console.error("Error saving ingredient:", error?.message || error);
      Alert.alert("Can't save", getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const blocked = saving || loadingNutrients || loadError;

  // แถวกรอกสารอาหาร 1 ตัว (ใช้ทั้งรายการหลักและรายการเพิ่มเติม)
  const renderNutrientRow = (n: Nutrient, removable: boolean) => (
    <View key={n.nutrient_id} style={styles.nutrientRow}>
      <Text style={styles.nutrientName} numberOfLines={1}>
        {getNutrientLabel(n.nutrient_name)}
        {!isAdmin && USER_REQUIRED_NUTRIENT_NAMES.includes(n.nutrient_name) && (
          <Text style={{ color: "#FF3B30" }}> *</Text>
        )}
      </Text>
      <TextInput
        style={styles.nutrientInput}
        value={values[n.nutrient_id] ?? ""}
        onChangeText={(t) => handleChangeValue(n.nutrient_id, t)}
        placeholder="0"
        placeholderTextColor="#BBB"
        keyboardType="decimal-pad"
        editable={!saving}
      />
      <Text style={styles.unitText}>{n.nutrient_unit || ""}</Text>
      {removable && (
        <TouchableOpacity
          onPress={() => removeExtra(n.nutrient_id)}
          disabled={saving}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.removeBtn}
        >
          <Ionicons name="close-circle" size={20} color="#C7C7CC" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {!!heading && <Text style={styles.title}>{heading}</Text>}

      {isAdmin ? (
        <>
          <Text style={styles.label}>Name (English)</Text>
          <TextInput
            style={styles.input}
            value={nameEn}
            onChangeText={setNameEn}
            placeholder="e.g., chicken breast"
            placeholderTextColor="#999"
            editable={!saving}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Name (Thai)</Text>
          <TextInput
            style={styles.input}
            value={nameTh}
            onChangeText={setNameTh}
            placeholder="เช่น อกไก่"
            placeholderTextColor="#999"
            editable={!saving}
          />
          <Text style={styles.helper}>Fill at least one. Existing system names can't be added again.</Text>
        </>
      ) : (
        <>
          <Text style={styles.label}>Ingredient name</Text>
          <TextInput
            style={styles.input}
            value={nameEn}
            onChangeText={setNameEn}
            placeholder="e.g., Homemade chili paste / น้ำพริกเผา"
            placeholderTextColor="#999"
            editable={!saving}
          />
          <Text style={styles.helper}>
            Your ingredient is marked as unverified and only appears in your own list.
          </Text>
        </>
      )}

      <Text style={[styles.label, { marginTop: 18 }]}>Nutrients per 100 g</Text>
      <Text style={styles.helper}>
        Fields marked * are required. Fill in the others if you know them.
      </Text>

      {loadingNutrients && (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={ORANGE} />
        </View>
      )}

      {loadError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Couldn't load nutrients. Check your connection.</Text>
          <TouchableOpacity onPress={loadNutrients}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loadingNutrients && !loadError && (
        <>
          {/* สารอาหารหลัก */}
          {coreList.map((n) => renderNutrientRow(n, false))}

          {/* สารอาหารที่เลือกเพิ่ม */}
          {extraList.length > 0 && (
            <>
              <Text style={[styles.subLabel]}>Additional nutrients</Text>
              {extraList.map((n) => renderNutrientRow(n, true))}
            </>
          )}

          {/* ปุ่มเปิดแผงเลือกสารอาหารเพิ่ม (เลือกได้ทีละหลายตัว) */}
          {addablePool.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.addMoreBtn}
                activeOpacity={0.8}
                onPress={() => setShowExtraPanel((v) => !v)}
                disabled={saving}
              >
                <Ionicons
                  name={showExtraPanel ? "chevron-up" : "add-circle-outline"}
                  size={18}
                  color={ORANGE_DARK}
                />
                <Text style={styles.addMoreText}>
                  {showExtraPanel ? "Hide" : `Add more nutrients (${addablePool.length})`}
                </Text>
              </TouchableOpacity>

              {showExtraPanel && (
                <View style={styles.extraPanel}>
                  <TextInput
                    style={styles.extraSearch}
                    value={extraQuery}
                    onChangeText={setExtraQuery}
                    placeholder="Search nutrient"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                  />

                  <ScrollView
                    style={{ maxHeight: 240 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {filteredPool.length === 0 ? (
                      <Text style={styles.emptyText}>No matching nutrients</Text>
                    ) : (
                      filteredPool.map((n) => {
                        const checked = pendingIds.includes(n.nutrient_id);
                        return (
                          <TouchableOpacity
                            key={n.nutrient_id}
                            style={styles.pickRow}
                            activeOpacity={0.7}
                            onPress={() => togglePending(n.nutrient_id)}
                          >
                            <Ionicons
                              name={checked ? "checkbox" : "square-outline"}
                              size={22}
                              color={checked ? ORANGE : "#C7C7CC"}
                            />
                            <Text style={styles.pickName}>{getNutrientLabel(n.nutrient_name)}</Text>
                            <Text style={styles.unitText}>{n.nutrient_unit || ""}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.confirmExtraBtn, pendingIds.length === 0 && { opacity: 0.5 }]}
                    activeOpacity={0.85}
                    disabled={pendingIds.length === 0}
                    onPress={confirmAddExtra}
                  >
                    <Text style={styles.confirmExtraText}>
                      {pendingIds.length > 0 ? `Add selected (${pendingIds.length})` : "Select nutrients to add"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </>
      )}

      <Text style={[styles.label, { marginTop: 18 }]}>Tags</Text>
      <Text style={styles.helper}>Tap a group to open it, then mark the tags that apply (optional).</Text>
      {/* กลุ่ม Cuisine/Culture เป็นแท็กของสูตร ไม่ใช่ของวัตถุดิบ จึงไม่แสดงที่นี่ (เลือกในหน้าสร้างสูตร) */}
      <IngredientTagPicker
        selected={tagIds}
        onChange={setTagIds}
        excludeGroupIds={[CUISINE_GROUP_ID]}
        disabled={saving}
      />

      <View style={styles.buttonRow}>
        {onCancel && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            activeOpacity={0.75}
            onPress={onCancel}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, styles.saveButton, blocked && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={blocked}
        >
          {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>{submitLabel}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  title: { fontSize: 18, fontWeight: "bold", color: ORANGE_DARK, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#3A3A3C", marginBottom: 6 },
  subLabel: { fontSize: 12, fontWeight: "600", color: "#8E8E93", marginTop: 14, marginBottom: 2 },
  helper: { fontSize: 12, color: "#8E8E93", marginTop: 6, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#F8F9FA",
  },

  centerBlock: { paddingVertical: 20, alignItems: "center" },
  errorBox: { padding: 14, backgroundColor: "#FFF3CD", borderRadius: 12, marginVertical: 10 },
  errorText: { color: "#7A5B00", fontSize: 13, marginBottom: 6 },
  retryText: { color: ORANGE_DARK, fontWeight: "700", fontSize: 13 },
  emptyText: { textAlign: "center", paddingVertical: 12, fontSize: 13, color: "#8E8E93" },

  nutrientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: ORANGE_LIGHT,
  },
  nutrientName: { flex: 1, fontSize: 14, color: "#3A3A3C" },
  nutrientInput: {
    width: 90,
    height: 40,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    textAlign: "right",
    fontSize: 15,
    color: "#333",
    backgroundColor: ORANGE_LIGHT,
  },
  unitText: { width: 44, marginLeft: 8, fontSize: 13, color: "#8E8E93" },
  removeBtn: { marginLeft: 4 },

  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: ORANGE_BORDER,
    backgroundColor: ORANGE_LIGHT,
  },
  addMoreText: { marginLeft: 6, fontSize: 14, fontWeight: "600", color: ORANGE_DARK },

  extraPanel: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    backgroundColor: "#FFF",
  },
  extraSearch: {
    height: 42,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#F8F9FA",
    marginBottom: 8,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: ORANGE_LIGHT,
  },
  pickName: { flex: 1, marginLeft: 10, fontSize: 14, color: "#3A3A3C" },
  confirmExtraBtn: {
    height: 42,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: ORANGE_SOFT,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmExtraText: { fontSize: 14, fontWeight: "700", color: ORANGE_DARK },

  buttonRow: { flexDirection: "row", marginTop: 22 },
  button: { flex: 1, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  cancelButton: { backgroundColor: "#F2F2F7", marginRight: 10 },
  cancelButtonText: { color: "#8E8E93", fontSize: 16, fontWeight: "600" },
  saveButton: {
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});
