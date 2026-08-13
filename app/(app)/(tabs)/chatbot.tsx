import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

// 💡 1. Configure backend endpoint address
const getBackendUrl = () => {
  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:8000/api/chat"; // Android Emulator
    }
    return "http://localhost:8000/api/chat"; // iOS Simulator
  }
  // Replace with your local Network IP if testing on a physical phone:
  // return "http://192.168.1.XX:8000/api/chat";
  return "https://192.168.0.101:8000/api/chat";
};

const BACKEND_URL = getBackendUrl();

// 💡 2. Match FastAPI's Pydantic Response Schema
interface ClassificationResult {
  intent: "usual_chat" | "meal_recommendation" | "recipe_recommendation";
  preferences: string[];
}

export default function ChatbotScreen() {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    Keyboard.dismiss();
    setLoading(true);
    setError(null);

    try {
      // 💡 3. Send HTTP POST request to FastAPI
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputText, // Matches UserMessageRequest schema in FastAPI
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || `Server Error (${response.status})`,
        );
      }

      const data: ClassificationResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Could not connect to FastAPI server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>🤖 Intent Classifier Test</Text>

        {/* Middle Screen Result Display */}
        <View style={styles.centerContainer}>
          {loading && (
            <View style={styles.statusBox}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>
                Classifying via Groq LLM...
              </Text>
            </View>
          )}

          {error && (
            <View style={[styles.statusBox, styles.errorBox]}>
              <Text style={styles.errorTitle}>Connection Failed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !error && result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>FastAPI Response</Text>

              <View style={styles.row}>
                <Text style={styles.label}>Intent:</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{result.intent}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Extracted Preferences:</Text>
                {result.preferences.length > 0 ? (
                  <View style={styles.tagContainer}>
                    {result.preferences.map((pref, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>🏷️ {pref}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>None detected</Text>
                )}
              </View>

              {/* Raw JSON viewer to verify response structure */}
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>
                  {JSON.stringify(result, null, 2)}
                </Text>
              </View>
            </View>
          )}

          {!loading && !error && !result && (
            <Text style={styles.placeholderText}>
              Enter a message below to test classification and constraint
              extraction.
            </Text>
          )}
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Recommend a meal, no sweet and low salt"
            placeholderTextColor="#8E8E93"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || loading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: "#1C1C1E",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 16,
  },
  placeholderText: {
    color: "#8E8E93",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  statusBox: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  errorBox: {
    backgroundColor: "#FFD2D2",
    borderRadius: 12,
    padding: 16,
    width: "100%",
  },
  errorTitle: {
    fontWeight: "700",
    color: "#D32F2F",
    marginBottom: 4,
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 13,
  },
  resultCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
    marginRight: 8,
  },
  badge: {
    backgroundColor: "#E5F1FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: "#007AFF",
    fontWeight: "700",
    fontSize: 13,
  },
  section: {
    marginBottom: 12,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  tag: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 13,
    color: "#1C1C1E",
    fontWeight: "500",
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 4,
  },
  codeBlock: {
    backgroundColor: "#1C1C1E",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  codeText: {
    color: "#34C759",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 15,
    color: "#1C1C1E",
    paddingHorizontal: 8,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
