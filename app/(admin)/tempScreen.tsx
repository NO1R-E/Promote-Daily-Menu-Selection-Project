import { StyleSheet, Text, View } from "react-native";

export default function tempScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Admin Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18, fontWeight: "500" },
});
