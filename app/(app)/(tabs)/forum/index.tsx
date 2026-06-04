import { StyleSheet, Text, View } from "react-native";

export default function ForumIndex() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🍲 Recipe Forum Main Feed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18, fontWeight: "500" },
});
