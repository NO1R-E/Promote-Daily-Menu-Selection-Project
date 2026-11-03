import Slider from "@react-native-community/slider";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SLOTS, SLOT_LABEL, Shares } from "@/src/types/PlanType";

type Props = {
  shares: Shares;
  dailyKcal: number;
  dailyProtein: number;
  onChange: (next: Shares) => void;
  onCommit: (next: Shares) => void;
};

// ปรับสัดส่วนให้รวมเป็น 100 โดยคงอัตราส่วนเดิมของแต่ละมื้อ
function balanced(shares: Shares): Shares {
  const total = SLOTS.reduce((sum, s) => sum + shares[s], 0);
  if (total === 0) return shares;
  const next = { ...shares };
  SLOTS.forEach((s) => {
    next[s] = Math.min(60, Math.round((shares[s] * 100) / total));
  });
  const diff = 100 - SLOTS.reduce((sum, s) => sum + next[s], 0);
  const biggest = SLOTS.reduce((a, b) => (next[b] > next[a] ? b : a));
  next[biggest] = Math.min(60, Math.max(0, next[biggest] + diff));
  return next;
}

export default function MealShareSliders({
  shares,
  dailyKcal,
  dailyProtein,
  onChange,
  onCommit,
}: Props) {
  const total = SLOTS.reduce((sum, s) => sum + shares[s], 0);
  const ok = total === 100;

  return (
    <View style={styles.box}>
      {SLOTS.map((slot) => {
        const pct = shares[slot];
        return (
          <View key={slot} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>{SLOT_LABEL[slot]}</Text>
              <Text style={styles.readout}>
                {pct === 0
                  ? "Skipped"
                  : `${pct}% · ${Math.round((dailyKcal * pct) / 100)} kcal · ${Math.round(
                      (dailyProtein * pct) / 100,
                    )} g protein`}
              </Text>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={60}
              step={1}
              value={pct}
              minimumTrackTintColor="#FF7A00"
              thumbTintColor="#FF7A00"
              onValueChange={(v) =>
                onChange({ ...shares, [slot]: Math.round(v) })
              }
              onSlidingComplete={(v) =>
                onCommit({ ...shares, [slot]: Math.round(v) })
              }
            />
          </View>
        );
      })}

      <View style={styles.totalRow}>
        <View style={styles.statusBadge}>
          <Text style={[styles.total, !ok && styles.totalYellow]}>
            {ok
              ? "Sum: 100% (Covers full day)"
              : total < 100
                ? `Sum: ${total}% (${100 - total}% unassigned)`
                : `Sum: ${total}% (${total - 100}% over target)`}
          </Text>
        </View>

        {!ok && (
          <TouchableOpacity
            style={styles.balanceBtn}
            activeOpacity={0.8}
            onPress={() => {
              const next = balanced(shares);
              onChange(next);
              onCommit(next);
            }}
          >
            <Text style={styles.balanceText}>Balance to 100%</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Slide to 0 to skip a meal.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  row: { marginBottom: 10 },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  label: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  readout: { fontSize: 12, color: "#6C6C70" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 32, // Fixed height prevents lower content jump
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  total: {
    fontSize: 13,
    color: "#2E7D32",
    fontWeight: "700",
  },
  totalYellow: {
    color: "#F57F17",
    fontWeight: "700",
  },
  balanceBtn: {
    backgroundColor: "#FF7A00",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    shadowColor: "#FF7A00",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  balanceText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  hint: { fontSize: 11, color: "#8E8E93", marginTop: 4 },
});
