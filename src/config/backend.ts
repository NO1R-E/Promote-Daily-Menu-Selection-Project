import { Platform } from "react-native";

export const getBackendUrl = (): string => {
  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:8000"; // Android Emulator
    }
    return "http://localhost:8000"; // iOS Simulator
  }
  return "https://192.168.0.101:8000"; // Physical Device / Production
};

export const BASE_URL = getBackendUrl();
