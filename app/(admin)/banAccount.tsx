import { StyleSheet, Text, View } from "react-native";

export default function banAccount() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ban Account</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18, fontWeight: "500" },
});