// src/components/forms/IngredientTagPicker.tsx
// เลือกแท็กของวัตถุดิบ แสดง "ทุกกลุ่ม" ใน tag_groups (ทั้งผู้ใช้และแอดมินเห็นเหมือนกัน)
// แต่ละกลุ่มกดเปิด/ปิดได้ แท็กในกลุ่มจะโผล่เมื่อกดเปิดกลุ่มนั้น
// มีแถบ "Selected" สรุปแท็กที่เลือกไว้ด้านบน (กด x เพื่อเอาออกได้) เห็นได้แม้ทุกกลุ่มจะพับอยู่
//
// - กลุ่มที่ยังไม่มีแท็กที่ใช้งานอยู่ (is_active) จะแสดงเป็นสีเทาว่า "No tags" (ไม่ซ่อน)
// - แท็กที่อยู่ในกลุ่มที่ไม่มีใน tag_groups (หรืออ่าน tag_groups ไม่ได้) ก็ยังแสดง โดยตั้งชื่อกลุ่มว่า "Group <id>"

import { useEffect, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/config/supabase";
import { ORANGE, ORANGE_BORDER, ORANGE_DARK, ORANGE_LIGHT, ORANGE_SOFT } from "./ingredientCommon";

type Group = { group_id: number; group_name: string };
type Tag = { tag_id: number; tag_name: string; group_id: number };

type Props = {
  selected: number[];
  onChange: (tagIds: number[]) => void;
  disabled?: boolean;
  excludeGroupIds?: number[]; // ไม่แสดงกลุ่มเหล่านี้ (เช่น Cuisine/Culture ในฟอร์มวัตถุดิบ)
  onlyGroupIds?: number[]; // แสดงเฉพาะกลุ่มเหล่านี้ (เช่น Cuisine/Culture ในหน้าสร้างสูตร)
  defaultExpanded?: boolean; // กางทุกกลุ่มตั้งแต่เริ่ม
  hideSummary?: boolean; // ซ่อนแถบ "Selected" ด้านบน
  singleSelect?: boolean; // เลือกได้ 1 อัน: กดอันใหม่จะแทนที่อันเดิม และกดอันที่เลือกอยู่ซ้ำไม่ยกเลิก (จึงไม่มีทางว่าง)
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
}: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]); // group_id ที่กางอยู่

  const loadTags = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // ดึงกลุ่มกับแท็กที่ใช้งานอยู่พร้อมกัน (กรองกลุ่มตาม onlyGroupIds / excludeGroupIds)
      let tagQuery: any = supabase
        .from("tags")
        .select("tag_id, tag_name, group_id")
        .eq("is_active", true)
        .order("tag_name", { ascending: true });

      if (onlyGroupIds && onlyGroupIds.length > 0) {
        tagQuery = tagQuery.in("group_id", onlyGroupIds);
      } else if (excludeGroupIds && excludeGroupIds.length > 0) {
        tagQuery = tagQuery.not("group_id", "in", `(${excludeGroupIds.join(",")})`);
      }

      const [groupRes, tagRes] = await Promise.all([
        supabase.from("tag_groups").select("group_id, group_name").order("group_id", { ascending: true }),
        tagQuery,
      ]);

      if (tagRes.error) throw tagRes.error;
      const tagList = ((tagRes.data as Tag[]) || []).filter((t) => t.group_id != null);

      const groupMap = new Map<number, Group>();
      if (!groupRes.error && groupRes.data) {
        (groupRes.data as any[]).forEach((g) =>
          groupMap.set(g.group_id, { group_id: g.group_id, group_name: g.group_name || `Group ${g.group_id}` })
        );
      } else if (groupRes.error) {
        console.warn("Could not read tag_groups, deriving groups from tags:", groupRes.error.message);
      }

      // แท็กที่อยู่ในกลุ่มที่ไม่มีในรายการกลุ่ม ก็ต้องไม่หายไป
      tagList.forEach((t) => {
        if (!groupMap.has(t.group_id)) {
          groupMap.set(t.group_id, { group_id: t.group_id, group_name: `Group ${t.group_id}` });
        }
      });

      let groupList = Array.from(groupMap.values()).sort((a, b) => a.group_id - b.group_id);
      if (onlyGroupIds && onlyGroupIds.length > 0) {
        groupList = groupList.filter((g) => onlyGroupIds.includes(g.group_id));
      } else if (excludeGroupIds && excludeGroupIds.length > 0) {
        groupList = groupList.filter((g) => !excludeGroupIds.includes(g.group_id));
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

  const toggleGroup = (groupId: number) => {
    setExpanded((prev) => (prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId]));
  };

  const toggleTag = (tagId: number) => {
    if (disabled) return;
    if (singleSelect) {
      if (!selected.includes(tagId)) onChange([tagId]);
      return;
    }
    onChange(selected.includes(tagId) ? selected.filter((id) => id !== tagId) : [...selected, tagId]);
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
        <Text style={styles.errorText}>Couldn't load tags. Check your connection.</Text>
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
      {selectedTags.length > 0 && !hideSummary && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Selected ({selectedTags.length})</Text>
          <View style={styles.chipWrap}>
            {selectedTags.map((tag) => (
              <TouchableOpacity
                key={tag.tag_id}
                activeOpacity={0.8}
                onPress={() => toggleTag(tag.tag_id)}
                style={[styles.chip, styles.chipSelected]}
              >
                <Text style={styles.chipTextSelected}>{tag.tag_name}</Text>
                <Ionicons name="close" size={13} color="#FFF" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ทุกกลุ่ม กดเพื่อเปิด/ปิด */}
      {groups.map((group) => {
        const items = tags.filter((t) => t.group_id === group.group_id);
        const isEmpty = items.length === 0;
        const isOpen = !isEmpty && expanded.includes(group.group_id);
        const count = items.filter((t) => selected.includes(t.tag_id)).length;

        return (
          <View key={group.group_id} style={[styles.groupBox, isEmpty && styles.groupBoxEmpty]}>
            <TouchableOpacity
              style={styles.groupHeader}
              activeOpacity={0.8}
              disabled={isEmpty}
              onPress={() => toggleGroup(group.group_id)}
            >
              <Text style={[styles.groupName, isEmpty && styles.groupNameEmpty]}>{group.group_name}</Text>
              {count > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{count}</Text>
                </View>
              )}
              <Text style={styles.groupTotal}>{isEmpty ? "No tags" : items.length}</Text>
              {!isEmpty && <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={ORANGE_DARK} />}
            </TouchableOpacity>

            {isOpen && (
              <View style={[styles.chipWrap, styles.groupBody]}>
                {items.map((tag) => {
                  const isSelected = selected.includes(tag.tag_id);
                  return (
                    <TouchableOpacity
                      key={tag.tag_id}
                      activeOpacity={0.8}
                      onPress={() => toggleTag(tag.tag_id)}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={13} color="#FFF" style={{ marginRight: 4 }} />}
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{tag.tag_name}</Text>
                    </TouchableOpacity>
                  );
                })}
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
  errorBox: { padding: 12, backgroundColor: "#FFF3CD", borderRadius: 12 },
  errorText: { color: "#7A5B00", fontSize: 13, marginBottom: 6 },
  retryText: { color: ORANGE_DARK, fontWeight: "700", fontSize: 13 },
  emptyText: { color: "#999", fontSize: 13, fontStyle: "italic" },

  summary: { marginBottom: 10 },
  summaryLabel: { fontSize: 12, fontWeight: "600", color: "#8E8E93", marginBottom: 6 },

  groupBox: {
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "#FFF",
  },
  groupBoxEmpty: { borderColor: "#E5E5EA" },
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
