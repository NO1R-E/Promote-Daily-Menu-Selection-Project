import { Platform } from "react-native";
const MY_CURRENT_LOCAL_IP = "192.168.0.101"; //fallback use your local IP address

export const getBackendUrl = (): string => {
  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:8000"; // Android Emulator
    }
    return "http://localhost:8000"; // iOS Simulator
  }
  return `https://${MY_CURRENT_LOCAL_IP}:8000`; // Physical Device / Production
};

export const BASE_URL = getBackendUrl();
