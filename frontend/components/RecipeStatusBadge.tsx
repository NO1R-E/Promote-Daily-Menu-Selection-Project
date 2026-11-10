// Small pill showing whether a recipe has been checked by an admin.
// verified = every ingredient is admin-verified; pending = not yet checked (nutrition, diet and allergen labels may be off).
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = { status?: string | null; compact?: boolean }; // compact = icon only (next to a title)

export default function RecipeStatusBadge({ status, compact }: Props) {
  if (compact) {
    if (status === "verified")
      return <Ionicons name="checkmark-circle" size={18} color="#34C759" />;
    if (status === "pending")
      return <Ionicons name="alert-circle-outline" size={18} color="#E6A100" />;
    return null;
  }
  if (status === "verified") {
    return (
      <View style={[styles.pill, styles.ok]}>
        <Ionicons name="checkmark-circle" size={13} color="#1E7B34" />
        <Text style={[styles.text, { color: "#1E7B34" }]}>Verified</Text>
      </View>
    );
  }
  if (status === "pending") {
    return (
      <View style={[styles.pill, styles.warn]}>
        <Ionicons name="alert-circle-outline" size={13} color="#9A5B00" />
        <Text style={[styles.text, { color: "#9A5B00" }]}>Unverified</Text>
      </View>
    );
  }
  return null; // rejected / unknown: no badge
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  ok: { backgroundColor: "#E6F7EA" },
  warn: { backgroundColor: "#FFF3D6" },
  text: { fontSize: 11, fontWeight: "700" },
});
