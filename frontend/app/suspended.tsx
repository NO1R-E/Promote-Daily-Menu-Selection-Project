import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

export default function Suspended() {
  const { ban, refreshUserData } = useAuth();
  return (
    <View style={s.c}>
      <Text style={s.t}>Account suspended</Text>
      {!!ban?.reason && <Text style={s.p}>Reason: {ban.reason}</Text>}
      <Text style={s.p}>
        {ban?.expires_at
          ? `Until ${new Date(ban.expires_at).toLocaleString()}`
          : "This suspension is permanent."}
      </Text>
      <TouchableOpacity style={s.b} onPress={refreshUserData}>
        <Text style={s.bt}>Check again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.b, s.out]}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={[s.bt, { color: "#444" }]}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  c: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fff",
  },
  t: { fontSize: 22, fontWeight: "700" },
  p: { fontSize: 14, color: "#555" },
  b: {
    backgroundColor: "#FF7A00",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  out: { backgroundColor: "#eee" },
  bt: { color: "#fff", fontWeight: "600" },
});
