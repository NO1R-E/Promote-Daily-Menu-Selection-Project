import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useHealth } from "../src/contexts/HealthContext";

export function HealthBanner() {
  const { isServerHealthy, checkNow } = useHealth();
  const [showReconnected, setShowReconnected] = useState(false);
  const prevHealthyRef = useRef(isServerHealthy);

  useEffect(() => {
    if (!prevHealthyRef.current && isServerHealthy) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      prevHealthyRef.current = isServerHealthy;
      return () => clearTimeout(t);
    }
    prevHealthyRef.current = isServerHealthy;
  }, [isServerHealthy]);

  if (!isServerHealthy) {
    return (
      <View style={styles.healthBanner}>
        <Text style={styles.healthBannerText}>
          Server unreachable — some features may not work
        </Text>
        <TouchableOpacity onPress={checkNow}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showReconnected) {
    return (
      <View style={styles.reconnectedBanner}>
        <Text style={styles.reconnectedText}>Back online</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  healthBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: "#FFE08A",
  },
  healthBannerText: { color: "#7A5B00", fontSize: 13, flex: 1 },
  retryText: {
    color: "#007AFF",
    fontWeight: "600",
    fontSize: 13,
    marginLeft: 10,
  },
  reconnectedBanner: {
    backgroundColor: "#E8F5E9",
    paddingVertical: 6,
    alignItems: "center",
  },
  reconnectedText: { color: "#2E7D32", fontSize: 13, fontWeight: "600" },
});
