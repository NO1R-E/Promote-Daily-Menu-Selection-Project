import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { BASE_URL } from "../config/backend";

type HealthState = {
  isServerHealthy: boolean;
  isChecking: boolean;
  lastChecked: number | null;
};

type HealthContextType = HealthState & {
  checkNow: () => Promise<void>;
};

const HealthContext = createContext<HealthContextType>({} as HealthContextType);

const CHECK_INTERVAL_MS = 25_000;
const HEALTH_TIMEOUT_MS = 5_000;

export const HealthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<HealthState>({
    isServerHealthy: true,
    isChecking: false,
    lastChecked: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkNow = async () => {
    setState((prev) => ({ ...prev, isChecking: true }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    console.log("Checking server health...");
    try {
      const res = await fetch(`${BASE_URL}/health`, {
        signal: controller.signal,
      });
      setState({
        isServerHealthy: res.ok,
        isChecking: false,
        lastChecked: Date.now(),
      });
    } catch {
      setState({
        isServerHealthy: false,
        isChecking: false,
        lastChecked: Date.now(),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const startPolling = () => {
    if (intervalRef.current) return;
    checkNow();
    intervalRef.current = setInterval(checkNow, CHECK_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startPolling();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") startPolling();
      else stopPolling();
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  }, []);

  return (
    <HealthContext.Provider value={{ ...state, checkNow }}>
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => useContext(HealthContext);
