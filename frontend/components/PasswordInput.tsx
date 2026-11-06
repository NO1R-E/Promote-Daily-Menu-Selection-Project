import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ORANGE_BORDER, ORANGE_DARK } from "@/components/forms/ingredientCommon";

// Password box with an eye button that shows / hides the text.
export default function PasswordInput(props: TextInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        placeholderTextColor="#999"
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!visible}
        style={styles.input}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={visible ? "Hide password" : "Show password"}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={22}
          color={ORANGE_DARK}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: "#FFF",
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: "#333" },
});
