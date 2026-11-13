import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const SEARCH_PLACEHOLDER = "Search recipes, users, tags, ingredients";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder = SEARCH_PLACEHOLDER,
  loading = false,
  style,
}: Props) {
  return (
    <View style={[styles.box, style]}>
      <Ionicons
        name="search-outline"
        size={20}
        color="#999"
        style={styles.icon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {loading ? (
        <ActivityIndicator size="small" color="#FF7A00" />
      ) : value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={20} color="#BBB" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: "#333" },
});
