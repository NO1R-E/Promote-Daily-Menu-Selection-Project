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
import { useAuth } from "@/src/contexts/AuthContext";
import { useHealth } from "@/src/contexts/HealthContext";
import { estimateIngredient } from "@/src/api/ingredientAi";
import IngredientTagPicker, { TagHint } from "./IngredientTagPicker";
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

const DIET_GROUP_ID = 7;
const ALLERGEN_GROUP_ID = 6;
const DIET_NOTE =
  "Only pick a diet label if you are sure. Other people rely on these labels for religious or health reasons. If you are not sure, choose None.";
const DIET_HINTS: TagHint[] = [
  {
    match: /vegan/i,
    text: "No animal products at all: no meat, fish, egg, dairy or honey.",
  },
  {
    match: /vegetarian/i,
    text: "No meat or fish. May contain egg and/or dairy.",
  },
  {
    match: /\bj[ae]{1,2}y?\b|jea|เจ/i,
    text: "Jay (เจ) food: fully plant-based and also free of garlic, onion, leek, chives and other strong-smelling vegetables.",
  },
  {
    match: /halal|ฮาลาล/i,
    text: "Allowed under Islamic dietary law: no pork or alcohol, and any meat comes from an approved slaughter.",
  },
];

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
  editIngredientId?: number; // admin only: edit this VERIFIED ingredient instead of creating one
};

// ข้อความ error ที่ฟังก์ชัน create_ingredient ส่งมา -> ข้อความที่แสดงให้ผู้ใช้
const ERROR_MESSAGES: Record<string, string> = {
  INGREDIENT_EXISTS_SYSTEM:
    "This ingredient already exists in the system. Please select it from the System tab instead.",
  INGREDIENT_EXISTS_MINE: "You already added an ingredient with this name.",
  LIMIT_REACHED: "You've reached the maximum number of custom ingredients.",
  NAME_REQUIRED: "Please enter an ingredient name.",
  NAME_TOO_LONG: "The ingredient name is too long.",
  NUTRIENT_REQUIRED: "Please enter at least one nutrient value.",
  NUTRIENT_INVALID: "Some nutrient values are invalid.",
  NUTRIENT_OUT_OF_RANGE:
    "Some nutrient values look unrealistic for 100 g. Please check them.",
  TAG_INVALID: "Some selected tags are not allowed.",
  NOT_AUTHENTICATED: "Please log in again.",
  CALORIES_REQUIRED: "Please enter Calories.",
  FORBIDDEN: "Only admins can edit system ingredients.",
  INGREDIENT_NOT_FOUND: "This ingredient no longer exists.",
  ONLY_VERIFIED_EDITABLE: "Only system (verified) ingredients can be edited.",
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
  editIngredientId,
}: IngredientFormProps) {
  const isAdmin = mode === "admin";
  const isEdit = isAdmin && editIngredientId != null;
  const { user } = useAuth();
  const { isServerHealthy } = useHealth();
  const heading =
    title ??
    (isEdit
      ? "Edit Ingredient (Admin)"
      : isAdmin
        ? "Add Ingredient (Admin)"
        : "Add Ingredient");
  const saveLabel = isEdit && submitLabel === "Save" ? "Save changes" : submitLabel;

  const [editLoading, setEditLoading] = useState(isEdit);

  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [loadingNutrients, setLoadingNutrients] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [nameEn, setNameEn] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [noneGroups, setNoneGroups] = useState<number[]>([]); // groups where the user chose "None"
  const [missingGroups, setMissingGroups] = useState<string[]>([]);
  const [showMissing, setShowMissing] = useState(false);
  const dietOn = DIET_GROUP_ID > 0;
  const [saving, setSaving] = useState(false);

  // AI assist: the user describes the ingredient, we pre-fill the form, the user reviews it
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null); // set => form currently holds an AI estimate

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
    const list = coreNames
      .map((name) => byName.get(name))
      .filter(Boolean) as Nutrient[];
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
  const addablePool = extraPool.filter(
    (n) => !extraIds.includes(n.nutrient_id),
  );
  const filteredPool = addablePool.filter((n) =>
    getNutrientLabel(n.nutrient_name)
      .toLowerCase()
      .includes(extraQuery.trim().toLowerCase()),
  );

  // edit mode: load the existing ingredient once the nutrient list is known
  useEffect(() => {
    if (!isEdit || nutrients.length === 0) return;
    let cancelled = false;
    (async () => {
      setEditLoading(true);
      try {
        const [ing, nut, tg] = await Promise.all([
          supabase
            .from("ingredients")
            .select("norm_en, norm_th, status")
            .eq("ingredient_id", editIngredientId)
            .single(),
          supabase
            .from("ingredient_nutrients")
            .select("nutrient_id, amount")
            .eq("ingredient_id", editIngredientId),
          supabase
            .from("ingredient_tags")
            .select("tag_id, tags(group_id)")
            .eq("ingredient_id", editIngredientId),
        ]);
        if (ing.error) throw ing.error;
        if (nut.error) throw nut.error;
        if (tg.error) throw tg.error;
        if (cancelled) return;

        const coreIds = new Set(coreList.map((n) => n.nutrient_id));
        const vals: Record<number, string> = {};
        const extra: number[] = [];
        (nut.data ?? []).forEach((r: any) => {
          const id = Number(r.nutrient_id);
          vals[id] = String(r.amount);
          if (!coreIds.has(id)) extra.push(id);
        });
        const tagRows = (tg.data ?? []) as any[];
        const ids = tagRows.map((r) => Number(r.tag_id));
        const hasDiet = tagRows.some((r) => {
          const t = Array.isArray(r.tags) ? r.tags[0] : r.tags;
          return Number(t?.group_id) === DIET_GROUP_ID;
        });

        setNameEn(ing.data?.norm_en ?? "");
        setNameTh(ing.data?.norm_th ?? "");
        setValues(vals);
        setExtraIds(extra);
        setTagIds(ids);
        setNoneGroups(hasDiet ? [] : [DIET_GROUP_ID]);
      } catch (e: any) {
        console.error("Error loading ingredient:", e?.message || e);
        Alert.alert("Error", "Couldn't load this ingredient.");
        onCancel?.();
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editIngredientId, nutrients]);

  const handleChangeValue = (nutrientId: number, text: string) => {
    setValues((prev) => ({ ...prev, [nutrientId]: sanitizeNumber(text) }));
  };

  const togglePending = (nutrientId: number) => {
    setPendingIds((prev) =>
      prev.includes(nutrientId)
        ? prev.filter((id) => id !== nutrientId)
        : [...prev, nutrientId],
    );
  };

  // เพิ่มสารอาหารที่ติ๊กไว้ทั้งหมดลงฟอร์มในครั้งเดียว
  const confirmAddExtra = () => {
    if (pendingIds.length === 0) return;
    setExtraIds((prev) => [
      ...prev,
      ...pendingIds.filter((id) => !prev.includes(id)),
    ]);
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

  // Ingredient-scoped tags the AI may choose from (cuisine / recipe-only groups are excluded)
  const loadAiTags = async () => {
    const { data, error } = await supabase
      .from("tags")
      .select("tag_id, tag_name, group_id, tag_groups!inner(group_name, scope)")
      .eq("is_active", true)
      .in("tag_groups.scope", ["ingredient", "both"])
      .neq("group_id", CUISINE_GROUP_ID)
      .neq("group_id", ALLERGEN_GROUP_ID) // the AI never assigns allergen or diet labels
      .neq("group_id", dietOn ? DIET_GROUP_ID : -1);
    if (error) throw error;
    return (data ?? []).map((t: any) => ({
      id: Number(t.tag_id),
      name: String(t.tag_name),
      group: t.tag_groups?.group_name ?? null,
    }));
  };

  const handleAiFill = async () => {
    const text = aiText.trim();
    if (!user?.id || aiBusy || saving || text.length < 3 || !isServerHealthy)
      return;
    setAiBusy(true);
    try {
      const tags = await loadAiTags();
      const result = await estimateIngredient({
        userId: user.id,
        description: text,
        nutrients: nutrients.map((n) => ({
          name: n.nutrient_name,
          unit: n.nutrient_unit,
        })),
        tags,
      });
      if (!result.is_ingredient) {
        Alert.alert(
          "Not an ingredient",
          "Please describe a food ingredient, e.g. “boiled egg” or “homemade chili paste”.",
        );
        return;
      }

      const byName = new Map(nutrients.map((n) => [n.nutrient_name, n]));
      const coreIds = new Set(coreList.map((n) => n.nutrient_id));
      const nextValues: Record<number, string> = {};
      const nextExtra: number[] = [];
      Object.entries(result.nutrients).forEach(([name, amount]) => {
        const n = byName.get(name);
        if (!n) return;
        nextValues[n.nutrient_id] = String(amount);
        if (!coreIds.has(n.nutrient_id)) nextExtra.push(n.nutrient_id);
      });

      if (Object.keys(nextValues).length === 0) {
        Alert.alert(
          "No estimate",
          "We couldn't estimate this one. Please fill the form manually.",
        );
        return;
      }

      // replace everything the previous estimate / typing put in the nutrient boxes
      setValues(nextValues);
      setExtraIds(nextExtra);
      setPendingIds([]);
      // keep what the user already chose in the Diet / Allergen groups; the AI never touches them
      {
        const { data: safeTags } = await supabase
          .from("tags")
          .select("tag_id")
          .in("group_id", [DIET_GROUP_ID, ALLERGEN_GROUP_ID]);
        const safeIds = new Set(
          (safeTags ?? []).map((t: any) => Number(t.tag_id)),
        );
        const keep = tagIds.filter((id) => safeIds.has(id));
        setTagIds([...keep, ...result.tag_ids]);
      }
      if (result.name && !nameEn.trim()) setNameEn(result.name);
      setAiNote(result.note || "Estimated from your description.");
    } catch (err: any) {
      Alert.alert(
        "Couldn't fill the form",
        err.message || "Please fill it in manually.",
      );
    } finally {
      setAiBusy(false);
    }
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

    if (missingGroups.length > 0) {
      setShowMissing(true);
      Alert.alert(
        "Warning",
        `Please choose an option for ${missingGroups.join(", ")} (or None).`,
      );
      return;
    }

    // รวมเฉพาะสารอาหารที่แสดงบนฟอร์มและกรอกค่าไว้ (ช่องว่างข้าม)
    const rows: { nutrient_id: number; amount: number }[] = [];
    for (const n of [...coreList, ...extraList]) {
      const raw = (values[n.nutrient_id] ?? "").trim();
      if (raw === "") continue;

      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        Alert.alert(
          "Warning",
          `Invalid value for ${getNutrientLabel(n.nutrient_name)}`,
        );
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

      if (isEdit) {
        const { error: updErr } = await supabase.rpc("admin_update_ingredient", {
          p_ingredient_id: editIngredientId,
          p_name_en: en || null,
          p_name_th: th || null,
          p_nutrients: rows,
          p_tag_ids: tagIds,
        });
        if (updErr) throw updErr;
        Alert.alert(
          "Saved",
          "Ingredient updated. Existing recipes keep the nutrition they already calculated.",
        );
        onSaved?.(Number(editIngredientId));
        return;
      }

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
      setNoneGroups([]);
      setShowMissing(false);
      setExtraIds([]);
      setPendingIds([]);
      setShowExtraPanel(false);
      setAiText("");
      setAiNote(null);
      onSaved?.(Number(data));
      if (isAdmin) Alert.alert("Success", "Ingredient added successfully");
    } catch (error: any) {
      // console.log (not console.error) so expected errors like duplicates don't open the red LogBox popup
      console.log("Error saving ingredient:", error?.message || error);
      Alert.alert("Can't save", getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const blocked = saving || loadingNutrients || loadError || editLoading;

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

      {/* AI assist (not when editing an existing ingredient) */}
      {!isEdit && (
      <View style={styles.aiBox}>
        <View style={styles.aiHeader}>
          <Ionicons name="sparkles-outline" size={16} color={ORANGE_DARK} />
          <Text style={styles.aiTitle}>Describe it, we'll fill the form</Text>
        </View>
        <TextInput
          style={styles.aiInput}
          value={aiText}
          onChangeText={setAiText}
          placeholder="e.g. homemade chili paste with garlic and dried chili, oily"
          placeholderTextColor="#999"
          multiline
          maxLength={300}
          editable={!saving && !aiBusy}
        />
        <TouchableOpacity
          style={[
            styles.aiBtn,
            (aiBusy ||
              aiText.trim().length < 3 ||
              loadingNutrients ||
              loadError ||
              !isServerHealthy) && { opacity: 0.5 },
          ]}
          onPress={handleAiFill}
          disabled={
            aiBusy ||
            aiText.trim().length < 3 ||
            loadingNutrients ||
            loadError ||
            saving ||
            !isServerHealthy
          }
          activeOpacity={0.85}
        >
          {aiBusy ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.aiBtnText}>
              {aiNote ? "Fill again" : "Fill form"}
            </Text>
          )}
        </TouchableOpacity>
        {!isServerHealthy && (
          <Text style={styles.aiOffline}>
            The assistant is offline right now. You can still fill the form by
            hand.
          </Text>
        )}
        {!!aiNote && (
          <Text style={styles.aiNote}>
            AI estimate per 100 g — please check the values and tags before
            saving. {aiNote}
          </Text>
        )}
      </View>
      )}

      {editLoading && (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={ORANGE} />
        </View>
      )}

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
          <Text style={styles.helper}>
            Fill at least one. Existing system names can't be added again.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.label}>Ingredient name *</Text>
          <TextInput
            style={styles.input}
            value={nameEn}
            onChangeText={setNameEn}
            placeholder="e.g., Homemade chili paste / น้ำพริกเผา"
            placeholderTextColor="#999"
            editable={!saving}
          />
          <Text style={styles.helper}>
            Your ingredient is marked as unverified and only appears in your own
            list.
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
          <Text style={styles.errorText}>
            Couldn't load nutrients. Check your connection.
          </Text>
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
                  {showExtraPanel
                    ? "Hide"
                    : `Add more nutrients (${addablePool.length})`}
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
                      <Text style={styles.emptyText}>
                        No matching nutrients
                      </Text>
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
                            <Text style={styles.pickName}>
                              {getNutrientLabel(n.nutrient_name)}
                            </Text>
                            <Text style={styles.unitText}>
                              {n.nutrient_unit || ""}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>

                  <TouchableOpacity
                    style={[
                      styles.confirmExtraBtn,
                      pendingIds.length === 0 && { opacity: 0.5 },
                    ]}
                    activeOpacity={0.85}
                    disabled={pendingIds.length === 0}
                    onPress={confirmAddExtra}
                  >
                    <Text style={styles.confirmExtraText}>
                      {pendingIds.length > 0
                        ? `Add selected (${pendingIds.length})`
                        : "Select nutrients to add"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </>
      )}

      <Text style={[styles.label, { marginTop: 18 }]}>Tags</Text>
      <Text style={styles.helper}>
        Tap a group to open it, then mark the tags that apply (optional).
      </Text>
      {/* กลุ่ม Cuisine/Culture เป็นแท็กของสูตร ไม่ใช่ของวัตถุดิบ จึงไม่แสดงที่นี่ (เลือกในหน้าสร้างสูตร) */}
      <IngredientTagPicker
        selected={tagIds}
        onChange={setTagIds}
        excludeGroupIds={[CUISINE_GROUP_ID]}
        disabled={saving}
        noneGroupIds={dietOn ? [DIET_GROUP_ID] : []}
        noneSelected={noneGroups}
        onNoneChange={setNoneGroups}
        hideTagNamePrefix="Non-"
        groupNotes={dietOn ? { [DIET_GROUP_ID]: DIET_NOTE } : undefined}
        tagHints={dietOn ? DIET_HINTS : undefined}
        onMissingChange={setMissingGroups}
        highlightMissing={showMissing}
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
          style={[
            styles.button,
            styles.saveButton,
            blocked && { opacity: 0.6 },
          ]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={blocked}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>{saveLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: ORANGE_DARK,
    marginBottom: 16,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#3A3A3C", marginBottom: 6 },
  subLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    marginTop: 14,
    marginBottom: 2,
  },
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

  aiBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    backgroundColor: ORANGE_LIGHT,
    marginBottom: 18,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  aiTitle: { fontSize: 14, fontWeight: "700", color: ORANGE_DARK },
  aiInput: {
    minHeight: 64,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#FFF",
    textAlignVertical: "top",
  },
  aiBtn: {
    height: 40,
    borderRadius: 12,
    backgroundColor: ORANGE,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  aiBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  aiOffline: { fontSize: 12, color: "#E66E00", marginTop: 8 },
  aiNote: { fontSize: 12, color: "#8E8E93", marginTop: 8 },

  centerBlock: { paddingVertical: 20, alignItems: "center" },
  errorBox: {
    padding: 14,
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    marginVertical: 10,
  },
  errorText: { color: "#7A5B00", fontSize: 13, marginBottom: 6 },
  retryText: { color: ORANGE_DARK, fontWeight: "700", fontSize: 13 },
  emptyText: {
    textAlign: "center",
    paddingVertical: 12,
    fontSize: 13,
    color: "#8E8E93",
  },

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
  addMoreText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: ORANGE_DARK,
  },

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
  button: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
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
