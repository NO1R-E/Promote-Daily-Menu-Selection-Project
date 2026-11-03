import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "@/src/config/supabase";

type Row = {
  profile_id: string;
  username: string | null;
  banned: boolean;
  ban_reason: string | null;
  ban_expires: string | null;
};

const DURATIONS: { label: string; days: number | null }[] = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Permanent", days: null },
];

export default function UsersScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [onlyBanned, setOnlyBanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const [target, setTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<number | null>(7);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users", {
      p_search: search.trim() || null,
    });
    if (error) Alert.alert("Error", error.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [search]);

  // Debounced search + initial load
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const unban = (u: Row) =>
    Alert.alert("Unban", `Lift the ban on ${u.username ?? "this user"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unban",
        onPress: async () => {
          const { error } = await supabase.rpc("admin_unban_user", {
            p_user: u.profile_id,
          });
          if (error) Alert.alert("Error", error.message);
          else load();
        },
      },
    ]);

  const closeSheet = () => {
    setTarget(null);
    setReason("");
    setDays(7);
  };

  const confirmBan = async () => {
    if (!target) return;
    if (!reason.trim()) {
      Alert.alert("Reason required", "The user will see this reason.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("admin_ban_user", {
      p_user: target.profile_id,
      p_reason: reason.trim(),
      p_days: days,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    closeSheet();
    load();
  };

  const data = onlyBanned ? rows.filter((r) => r.banned) : rows;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search username"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Banned only</Text>
        <Switch
          value={onlyBanned}
          onValueChange={setOnlyBanned}
          trackColor={{ true: "#FF7A00" }}
        />
      </View>

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#FF7A00" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r) => r.profile_id}
          refreshing={loading}
          onRefresh={load}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.username ?? "(no username)"}
                </Text>
                {item.banned && (
                  <Text style={styles.sub} numberOfLines={2}>
                    {item.ban_reason ?? "No reason"} ·{" "}
                    {item.ban_expires
                      ? `until ${new Date(item.ban_expires).toLocaleDateString()}`
                      : "permanent"}
                  </Text>
                )}
              </View>
              {item.banned ? (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#2E9E5B" }]}
                  onPress={() => unban(item)}
                >
                  <Text style={styles.btnText}>Unban</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#FF3B30" }]}
                  onPress={() => setTarget(item)}
                >
                  <Text style={styles.btnText}>Ban</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      <Modal
        visible={!!target}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.name}>Ban {target?.username ?? "user"}</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              placeholder="Reason (shown to the user)"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <View style={styles.chips}>
              {DURATIONS.map((d) => {
                const on = days === d.days;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setDays(d.days)}
                  >
                    <Text style={on ? styles.chipTextOn : styles.chipText}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={closeSheet} disabled={submitting}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#FF3B30" }]}
                onPress={confirmBan}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.btnText}>Confirm ban</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#F8F9FA" },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#FFF",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  switchLabel: { fontSize: 14, color: "#444" },
  empty: { textAlign: "center", marginTop: 32, color: "#999" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
    marginBottom: 6,
  },
  name: { fontSize: 15, fontWeight: "600", color: "#222" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  btn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 76,
    alignItems: "center",
  },
  btnText: { color: "#FFF", fontWeight: "600" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipOn: { backgroundColor: "#FF7A00", borderColor: "#FF7A00" },
  chipText: { color: "#444", fontSize: 13 },
  chipTextOn: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cancel: { color: "#666", fontSize: 14, padding: 8 },
});
