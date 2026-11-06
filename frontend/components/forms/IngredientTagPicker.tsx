// src/components/forms/IngredientTagPicker.tsx
// เลือกแท็กของวัตถุดิบ แสดง "ทุกกลุ่ม" ใน tag_groups (ทั้งผู้ใช้และแอดมินเห็นเหมือนกัน)
// แต่ละกลุ่มกดเปิด/ปิดได้ แท็กในกลุ่มจะโผล่เมื่อกดเปิดกลุ่มนั้น
// มีแถบ "Selected" สรุปแท็กที่เลือกไว้ด้านบน (กด x เพื่อเอาออกได้) เห็นได้แม้ทุกกลุ่มจะพับอยู่
//
// - กลุ่มที่ยังไม่มีแท็กที่ใช้งานอยู่ (is_active) จะแสดงเป็นสีเทาว่า "No tags" (ไม่ซ่อน)
// - แท็กที่อยู่ในกลุ่มที่ไม่มีใน tag_groups (หรืออ่าน tag_groups ไม่ได้) ก็ยังแสดง โดยตั้งชื่อกลุ่มว่า "Group <id>"

import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import {
  ORANGE,
  ORANGE_BORDER,
  ORANGE_DARK,
  ORANGE_LIGHT,
  ORANGE_SOFT,
} from "./ingredientCommon";

type Group = { group_id: number; group_name: string };
type Tag = {
  tag_id: number;
  tag_name: string;
  group_id: number;
  description?: string | null;
};

export type TagHint = { match: RegExp; text: string };

type Props = {
  selected: number[];
  onChange: (tagIds: number[]) => void;
  disabled?: boolean;
  excludeGroupIds?: number[]; // ไม่แสดงกลุ่มเหล่านี้ (เช่น Cuisine/Culture ในฟอร์มวัตถุดิบ)
  onlyGroupIds?: number[]; // แสดงเฉพาะกลุ่มเหล่านี้ (เช่น Cuisine/Culture ในหน้าสร้างสูตร)
  defaultExpanded?: boolean; // กางทุกกลุ่มตั้งแต่เริ่ม
  hideSummary?: boolean; // ซ่อนแถบ "Selected" ด้านบน
  singleSelect?: boolean; // เลือกได้ 1 อัน: กดอันใหม่จะแทนที่อันเดิม และกดอันที่เลือกอยู่ซ้ำไม่ยกเลิก (จึงไม่มีทางว่าง)

  // ----- กลุ่มที่ "ต้องเลือก" (เช่น Diet) : มีตัวเลือก None = ไม่ติดแท็กในกลุ่มนี้ -----
  // None ไม่ใช่แท็กและไม่บันทึกลงฐานข้อมูล เป็นแค่การยืนยันว่า "ตั้งใจไม่ติดแท็ก"
  noneGroupIds?: number[]; // กลุ่มที่ต้องเลือกแท็กหรือ None อย่างใดอย่างหนึ่ง
  noneSelected?: number[]; // กลุ่มที่ผู้ใช้เลือก None ไว้ (state อยู่ที่หน้าที่เรียกใช้)
  onNoneChange?: (groupIds: number[]) => void;
  hideTagNamePrefix?: string; // ซ่อนแท็กที่ชื่อขึ้นต้นด้วยข้อความนี้ (เฉพาะกลุ่มใน noneGroupIds) เช่น "Non-"
  groupNotes?: Record<number, string>; // ข้อความอธิบายใต้ชื่อกลุ่มเมื่อกางกลุ่ม
  tagHints?: TagHint[]; // คำอธิบายแท็ก (จับด้วยชื่อ) แสดงใต้ชิปเมื่อกางกลุ่ม
  onMissingChange?: (groupNames: string[]) => void; // รายชื่อกลุ่มที่ยังไม่ได้เลือก (ว่าง = ครบ)
  highlightMissing?: boolean; // ขอบแดงกลุ่มที่ยังไม่ได้เลือก (ใช้หลังกด Save แล้วไม่ผ่าน)
};

export default function IngredientTagPicker({
  selected,
  onChange,
  disabled = false,
  excludeGroupIds,
  onlyGroupIds,
  defaultExpanded = false,
  hideSummary = false,
  singleSelect = false,
  noneGroupIds,
  noneSelected = [],
  onNoneChange,
  hideTagNamePrefix,
  groupNotes,
  tagHints,
  onMissingChange,
  highlightMissing = false,
}: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [infoGroup, setInfoGroup] = useState<number | null>(null); // group whose tag meanings are shown
  const [expanded, setExpanded] = useState<number[]>([]); // group_id ที่กางอยู่

  const loadTags = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // ดึงกลุ่มกับแท็กที่ใช้งานอยู่พร้อมกัน (กรองกลุ่มตาม onlyGroupIds / excludeGroupIds)
      let tagQuery: any = supabase
        .from("tags")
        .select("tag_id, tag_name, group_id, description")
        .eq("is_active", true)
        .order("tag_name", { ascending: true });

      if (onlyGroupIds && onlyGroupIds.length > 0) {
        tagQuery = tagQuery.in("group_id", onlyGroupIds);
      } else if (excludeGroupIds && excludeGroupIds.length > 0) {
        tagQuery = tagQuery.not(
          "group_id",
          "in",
          `(${excludeGroupIds.join(",")})`,
        );
      }

      const [groupRes, tagRes] = await Promise.all([
        supabase
          .from("tag_groups")
          .select("group_id, group_name")
          .order("group_id", { ascending: true }),
        tagQuery,
      ]);

      if (tagRes.error) throw tagRes.error;
      const tagList = ((tagRes.data as Tag[]) || []).filter(
        (t) => t.group_id != null,
      );

      const groupMap = new Map<number, Group>();
      if (!groupRes.error && groupRes.data) {
        (groupRes.data as any[]).forEach((g) =>
          groupMap.set(g.group_id, {
            group_id: g.group_id,
            group_name: g.group_name || `Group ${g.group_id}`,
          }),
        );
      } else if (groupRes.error) {
        console.warn(
          "Could not read tag_groups, deriving groups from tags:",
          groupRes.error.message,
        );
      }

      // แท็กที่อยู่ในกลุ่มที่ไม่มีในรายการกลุ่ม ก็ต้องไม่หายไป
      tagList.forEach((t) => {
        if (!groupMap.has(t.group_id)) {
          groupMap.set(t.group_id, {
            group_id: t.group_id,
            group_name: `Group ${t.group_id}`,
          });
        }
      });

      let groupList = Array.from(groupMap.values()).sort(
        (a, b) => a.group_id - b.group_id,
      );
      if (onlyGroupIds && onlyGroupIds.length > 0) {
        groupList = groupList.filter((g) => onlyGroupIds.includes(g.group_id));
      } else if (excludeGroupIds && excludeGroupIds.length > 0) {
        groupList = groupList.filter(
          (g) => !excludeGroupIds.includes(g.group_id),
        );
      }

      setGroups(groupList);
      setTags(tagList);
      if (defaultExpanded) setExpanded(groupList.map((g) => g.group_id));
    } catch (error: any) {
      console.error("Error loading tags:", error?.message || error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // โหลดใหม่เมื่อเงื่อนไขกลุ่มเปลี่ยน
  const filterKey = `${(onlyGroupIds || []).join(",")}|${(excludeGroupIds || []).join(",")}`;
  useEffect(() => {
    loadTags();
  }, [filterKey]);

  const isNoneGroup = (gid: number) => !!noneGroupIds?.includes(gid);

  // แท็กที่แสดงจริงในกลุ่ม (ซ่อนแท็กขึ้นต้นด้วย hideTagNamePrefix ในกลุ่มที่มี None)
  const visibleTagsOf = (gid: number) =>
    tags.filter(
      (t) =>
        t.group_id === gid &&
        !(
          isNoneGroup(gid) &&
          hideTagNamePrefix &&
          t.tag_name.startsWith(hideTagNamePrefix)
        ),
    );

  // แจ้งหน้าที่เรียกใช้ว่ากลุ่มบังคับกลุ่มไหนยังไม่ได้เลือก
  useEffect(() => {
    if (!onMissingChange || loading || loadError) return;
    const missing = groups
      .filter((g) => isNoneGroup(g.group_id))
      .filter((g) => {
        const hasTag = tags.some(
          (t) => t.group_id === g.group_id && selected.includes(t.tag_id),
        );
        return !hasTag && !noneSelected.includes(g.group_id);
      })
      .map((g) => g.group_name);
    onMissingChange(missing);
  }, [groups, tags, selected, noneSelected, loading, loadError]);

  const pickNone = (gid: number) => {
    if (disabled || !onNoneChange) return;
    if (noneSelected.includes(gid)) {
      onNoneChange(noneSelected.filter((g) => g !== gid)); // กดซ้ำ = ยกเลิก
      return;
    }
    const inGroup = new Set(
      tags.filter((t) => t.group_id === gid).map((t) => t.tag_id),
    );
    onChange(selected.filter((id) => !inGroup.has(id))); // None แทนที่แท็กทั้งหมดของกลุ่ม
    onNoneChange([...noneSelected, gid]);
  };

  const toggleGroup = (groupId: number) => {
    setExpanded((prev) =>
      prev.includes(groupId)
        ? prev.filter((g) => g !== groupId)
        : [...prev, groupId],
    );
  };

  const toggleTag = (tagId: number) => {
    if (disabled) return;
    // เลือกแท็กจริงในกลุ่มที่มี None -> ยกเลิก None ของกลุ่มนั้น
    const tagGroup = tags.find((t) => t.tag_id === tagId)?.group_id;
    if (
      tagGroup != null &&
      noneSelected.includes(tagGroup) &&
      !selected.includes(tagId)
    ) {
      onNoneChange?.(noneSelected.filter((g) => g !== tagGroup));
    }
    if (singleSelect) {
      if (!selected.includes(tagId)) onChange([tagId]);
      return;
    }
    onChange(
      selected.includes(tagId)
        ? selected.filter((id) => id !== tagId)
        : [...selected, tagId],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={ORANGE} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>
          Couldn't load tags. Check your connection.
        </Text>
        <TouchableOpacity onPress={loadTags}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (groups.length === 0) {
    return <Text style={styles.emptyText}>No tags available</Text>;
  }

  const selectedTags = tags.filter((t) => selected.includes(t.tag_id));

  return (
    <View>
      {/* สรุปแท็กที่เลือกไว้ (เห็นได้แม้กลุ่มพับอยู่) */}
      {/* Tag meanings for one group (opened with the info button in the group header) */}
      <Modal
        visible={infoGroup != null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoGroup(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setInfoGroup(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {groups.find((g) => g.group_id === infoGroup)?.group_name ?? ""}
            </Text>
            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
            >
              {infoGroup != null &&
                visibleTagsOf(infoGroup).map((tag) => (
                  <Text key={tag.tag_id} style={styles.modalRow}>
                    <Text style={styles.modalTagName}>{tag.tag_name}</Text>
                    {tag.description ? ` — ${tag.description}` : ""}
                  </Text>
                ))}
              {infoGroup != null && isNoneGroup(infoGroup) && (
                <Text style={styles.modalRow}>
                  <Text style={styles.modalTagName}>None</Text>
                  {" — no label applies, or you are not sure."}
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalClose}
              activeOpacity={0.85}
              onPress={() => setInfoGroup(null)}
            >
              <Text style={styles.modalCloseText}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {selectedTags.length > 0 && !hideSummary && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>
            Selected ({selectedTags.length})
          </Text>
          <View style={styles.chipWrap}>
            {selectedTags.map((tag) => (
              <TouchableOpacity
                key={tag.tag_id}
                activeOpacity={0.8}
                onPress={() => toggleTag(tag.tag_id)}
                style={[styles.chip, styles.chipSelected]}
              >
                <Text style={styles.chipTextSelected}>{tag.tag_name}</Text>
                <Ionicons
                  name="close"
                  size={13}
                  color="#FFF"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ทุกกลุ่ม กดเพื่อเปิด/ปิด */}
      {groups.map((group) => {
        const items = visibleTagsOf(group.group_id);
        const hasNone = isNoneGroup(group.group_id);
        const noneOn = hasNone && noneSelected.includes(group.group_id);
        const isEmpty = items.length === 0 && !hasNone;
        const missing =
          highlightMissing &&
          hasNone &&
          !noneOn &&
          !items.some((t) => selected.includes(t.tag_id));
        const isOpen = !isEmpty && expanded.includes(group.group_id);
        const count =
          items.filter((t) => selected.includes(t.tag_id)).length +
          (noneOn ? 1 : 0);

        return (
          <View
            key={group.group_id}
            style={[
              styles.groupBox,
              isEmpty && styles.groupBoxEmpty,
              missing && styles.groupBoxMissing,
            ]}
          >
            <TouchableOpacity
              style={styles.groupHeader}
              activeOpacity={0.8}
              disabled={isEmpty}
              onPress={() => toggleGroup(group.group_id)}
            >
              <Text
                style={[styles.groupName, isEmpty && styles.groupNameEmpty]}
              >
                {group.group_name}
                {hasNone && <Text style={{ color: "#FF3B30" }}> *</Text>}
              </Text>
              {count > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{count}</Text>
                </View>
              )}
              {!isEmpty && (
                <TouchableOpacity
                  onPress={() => setInfoGroup(group.group_id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ marginRight: 8 }}
                  accessibilityLabel={`What do the ${group.group_name} tags mean?`}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={ORANGE_DARK}
                  />
                </TouchableOpacity>
              )}
              <Text style={styles.groupTotal}>
                {isEmpty ? "No tags" : items.length}
              </Text>
              {!isEmpty && (
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={ORANGE_DARK}
                />
              )}
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.groupBody}>
                {!!groupNotes?.[group.group_id] && (
                  <Text style={styles.groupNote}>
                    {groupNotes[group.group_id]}
                  </Text>
                )}
                <View style={styles.chipWrap}>
                  {hasNone && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => pickNone(group.group_id)}
                      style={[styles.chip, noneOn && styles.chipSelected]}
                    >
                      {noneOn && (
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color="#FFF"
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.chipText,
                          noneOn && styles.chipTextSelected,
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                  )}
                  {items.map((tag) => {
                    const isSelected = selected.includes(tag.tag_id);
                    return (
                      <TouchableOpacity
                        key={tag.tag_id}
                        activeOpacity={0.8}
                        onPress={() => toggleTag(tag.tag_id)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={13}
                            color="#FFF"
                            style={{ marginRight: 4 }}
                          />
                        )}
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {tag.tag_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {items.map((tag) => {
                  const hint = tagHints?.find((h) =>
                    h.match.test(tag.tag_name),
                  )?.text;
                  return hint ? (
                    <Text key={`hint-${tag.tag_id}`} style={styles.tagHint}>
                      <Text style={styles.tagHintName}>{tag.tag_name}: </Text>
                      {hint}
                    </Text>
                  ) : null;
                })}
                {hasNone && (
                  <Text style={styles.tagHint}>
                    None: no diet label applies, or you're not sure.
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 14, alignItems: "center" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ORANGE_DARK,
    marginBottom: 12,
  },
  modalRow: { fontSize: 14, color: "#3A3A3C", lineHeight: 20, marginBottom: 10 },
  modalTagName: { fontWeight: "700", color: "#1C1C1E" },
  modalClose: {
    height: 42,
    borderRadius: 12,
    backgroundColor: ORANGE,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  modalCloseText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  errorBox: { padding: 12, backgroundColor: "#FFF3CD", borderRadius: 12 },
  errorText: { color: "#7A5B00", fontSize: 13, marginBottom: 6 },
  retryText: { color: ORANGE_DARK, fontWeight: "700", fontSize: 13 },
  emptyText: { color: "#999", fontSize: 13, fontStyle: "italic" },

  summary: { marginBottom: 10 },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 6,
  },

  groupBox: {
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "#FFF",
  },
  groupBoxEmpty: { borderColor: "#E5E5EA" },
  groupBoxMissing: { borderColor: "#FF3B30" },
  groupNote: {
    fontSize: 12,
    color: "#B26A00",
    backgroundColor: "#FFF8E1",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  tagHint: { fontSize: 12, color: "#6C6C70", marginTop: 2, marginBottom: 2 },
  tagHintName: { fontWeight: "700", color: "#3A3A3C" },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: ORANGE_LIGHT,
  },
  groupName: { flex: 1, fontSize: 14, fontWeight: "600", color: ORANGE_DARK },
  groupNameEmpty: { color: "#B0B0B5" },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: ORANGE,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  countBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  groupTotal: { fontSize: 12, color: "#8E8E93", marginRight: 8 },
  groupBody: { padding: 12 },

  chipWrap: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    backgroundColor: ORANGE_SOFT,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: ORANGE, borderColor: ORANGE },
  chipText: { fontSize: 13, color: ORANGE_DARK, fontWeight: "500" },
  chipTextSelected: { fontSize: 13, color: "#FFF", fontWeight: "700" },
});
