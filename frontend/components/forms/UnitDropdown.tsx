// Drop-down for choosing the unit of an ingredient amount.
// The list shows the ingredient's special unit first, then the shared units, each with its grams: "tbsp (≈14.8 g)".
import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DbUnit, unitWithGrams } from "./units";

type Props = {
  units: DbUnit[];
  selected?: DbUnit;
  density: number; // g/ml of the ingredient, used for volume units
  title: string; // ingredient name
  loading?: boolean; // units still loading
  disabled?: boolean;
  onSelect: (u: DbUnit) => void;
};

export default function UnitDropdown({
  units,
  selected,
  density,
  title,
  loading,
  disabled,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const special = units.filter((u) => u.ingredient_id !== null);
  const shared = units.filter((u) => u.ingredient_id === null);

  const row = (u: DbUnit) => {
    const on = u.unit_id === selected?.unit_id;
    return (
      <TouchableOpacity
        key={u.unit_id}
        style={[styles.row, on && styles.rowOn]}
        onPress={() => {
          onSelect(u);
          setOpen(false);
        }}
      >
        <Text style={[styles.rowText, on && styles.rowTextOn]}>
          {unitWithGrams(u, density)}
        </Text>
        {on && <Ionicons name="checkmark" size={18} color="#F28E2B" />}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen(true)}
        disabled={disabled || loading || units.length === 0}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText} numberOfLines={1}>
          {loading ? "Loading units..." : selected ? unitWithGrams(selected, density) : "g"}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#C96A0A" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              Unit for {title}
            </Text>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {special.length > 0 && (
                <>
                  <Text style={styles.section}>Special unit of this ingredient</Text>
                  {special.map(row)}
                </>
              )}
              <Text style={styles.section}>Usual units</Text>
              {shared.map(row)}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 130,
    maxWidth: 190,
    borderWidth: 1,
    borderColor: "#F6C48F",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#C96A0A" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: { backgroundColor: "#FFF", borderRadius: 16, padding: 14 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#C96A0A", marginBottom: 6 },
  section: { fontSize: 12, fontWeight: "600", color: "#8E8E93", marginTop: 10, marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rowOn: { backgroundColor: "#FFF5EA" },
  rowText: { fontSize: 15, color: "#333" },
  rowTextOn: { fontWeight: "700", color: "#C96A0A" },
});
