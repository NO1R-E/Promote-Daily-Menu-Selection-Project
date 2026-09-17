import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { BASE_URL } from "../config/backend";

type HealthState = {
  isServerHealthy: boolean;
  isChecking: boolean;
  lastChecked: number | null;
};

type HealthContextType = HealthState & {
  checkNow: () => Promise<void>;
  reportSuccess: () => void;
  reportFailure: () => void;
};

const HealthContext = createContext<HealthContextType>({} as HealthContextType);
const HEALTH_TIMEOUT_MS = 5_000;

export const HealthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<HealthState>({
    isServerHealthy: true,
    isChecking: false,
    lastChecked: null,
  });

  const checkNow = async () => {
    setState((prev) => ({ ...prev, isChecking: true }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
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
  const reportSuccess = () =>
    setState((prev) => ({
      ...prev,
      isServerHealthy: true,
      lastChecked: Date.now(),
    }));
  const reportFailure = () =>
    setState((prev) => ({
      ...prev,
      isServerHealthy: false,
      lastChecked: Date.now(),
    }));

  useEffect(() => {
    checkNow();
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") checkNow();
    });
    return () => sub.remove();
  }, []);

  return (
    <HealthContext.Provider
      value={{ ...state, checkNow, reportSuccess, reportFailure }}
    >
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => useContext(HealthContext);
