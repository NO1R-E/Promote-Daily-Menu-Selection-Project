import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import UnitEditorModal from "@/components/forms/UnitEditorModal";
import {
  UniversalUnit,
  deleteUniversalUnit,
  fetchUniversalUnits,
  saveUniversalUnit,
} from "@/components/forms/units";

// Admin: the shared units every ingredient can use (g, kg, oz, lb, ml, L, tsp, tbsp, cup, ...).
// An ingredient's own units (egg = 50 g) are edited from the ingredient / recipe form instead.
export default function AdminUnits() {
  const [units, setUnits] = useState<UniversalUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ unit?: UniversalUnit } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUnits(await fetchUniversalUnits());
    } catch (e: any) {
      console.log("Loading shared units failed:", e?.message || e);
      setError("Couldn't load the units. Pull down to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderItem = ({ item }: { item: UniversalUnit }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => setEditor({ unit: item })}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {item.name_en}
          {!!item.name_th && <Text style={styles.th}>  {item.name_th}</Text>}
        </Text>
        <Text style={styles.sub}>
          1 {item.name_en} = {item.factor} {item.kind === "volume" ? "ml" : "g"}
          {item.kind === "volume" ? " (grams use the ingredient's density)" : ""}
        </Text>
        <Text style={styles.sub}>
          {item.used_count > 0
            ? `Used in ${item.used_count} recipe ingredient${item.used_count > 1 ? "s" : ""}`
            : "Not used yet"}
          {item.is_system ? " · required by the app" : ""}
        </Text>
      </View>
      <Ionicons name="create-outline" size={20} color="#BBB" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Shared units are available for every ingredient, and nobody can create an
        own unit with the same name. Changing a unit's amount does not change
        recipes that were already saved.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color="#FF7A00" />
      ) : (
        <FlatList
          data={units}
          keyExtractor={(u) => String(u.unit_id)}
          renderItem={renderItem}
          contentContainerStyle={{ gap: 10, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{error ?? "No units yet."}</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setEditor({})}
      >
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={styles.fabText}>Add shared unit</Text>
      </TouchableOpacity>

      <UnitEditorModal
        visible={editor !== null}
        mode="shared"
        initial={
          editor?.unit
            ? {
                nameEn: editor.unit.name_en,
                nameTh: editor.unit.name_th ?? "",
                value: editor.unit.factor,
                kind: editor.unit.kind,
                isSystem: editor.unit.is_system,
                usedCount: editor.unit.used_count,
              }
            : undefined
        }
        onClose={() => setEditor(null)}
        onSave={async (v) => {
          await saveUniversalUnit({
            unitId: editor?.unit?.unit_id ?? null,
            nameEn: v.nameEn,
            nameTh: v.nameTh,
            kind: v.kind,
            factor: v.value,
          });
          await load();
        }}
        onDelete={
          editor?.unit
            ? async () => {
                await deleteUniversalUnit(editor.unit!.unit_id);
                await load();
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F8F9FA" },
  intro: { fontSize: 12, color: "#8E8E93", marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  name: { fontSize: 15, fontWeight: "700", color: "#222" },
  th: { fontSize: 13, fontWeight: "400", color: "#888" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  empty: { textAlign: "center", color: "#888", marginTop: 30 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F28E2B",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    elevation: 4,
  },
  fabText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
