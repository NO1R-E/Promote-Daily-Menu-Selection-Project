// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { AuthContextType } from "../types/AuthContextType";
import { AuthState } from "../types/AuthState";

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Give up after `ms` so the app can never sit on the loading spinner forever
// (e.g. the phone can't reach Supabase).
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });

const LOAD_TIMEOUT_MS = 12000;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    personalData: null,
    terms_accepted: false,
    onboardingStatus: "not_started",
    loading: true,
    ban: null,
  });

  const clearState = () => {
    setState({
      session: null,
      user: null,
      profile: null,
      personalData: null,
      terms_accepted: false,
      onboardingStatus: "not_started",
      loading: false,
      ban: null,
    });
  };

  const loadExtendedUserData = async (userId: string) => {
    // timing logs: the one that never prints "done" is the query that hangs
    const t0 = Date.now();
    const step = (name: string) =>
      console.log(`[auth] ${name} done after ${Date.now() - t0} ms`);

    console.log("[auth] loading profile...");
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("profile_id", userId)
      .single();
    step("profile");
    if (profErr) console.warn("[auth] profile error:", profErr.message);

    console.log("[auth] loading ban...");
    const { data: banRows, error: banErr } = await supabase.rpc("get_my_ban");
    step("ban");
    if (banErr) console.warn("[auth] ban error:", banErr.message);
    const ban = banRows?.[0] ?? null;

    console.log("[auth] loading personalData...");
    const { data: metrics, error: metErr } = await supabase
      .from("personalData")
      .select("*")
      .eq("personal_id", userId)
      .maybeSingle();
    step("personalData");
    if (metErr) console.warn("[auth] personalData error:", metErr.message);

    return { prof, ban, metrics };
  };

  const fetchExtendedUserData = async (userId: string, activeSession: any) => {
    try {
      const { prof, ban, metrics } = await withTimeout(
        loadExtendedUserData(userId),
        LOAD_TIMEOUT_MS,
      );

      setState({
        session: activeSession,
        user: activeSession?.user ?? null,
        profile: prof,
        personalData: metrics,
        terms_accepted: prof?.terms_accepted || false,
        onboardingStatus: prof?.onboarding_status || "not_started",
        ban,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching extended user structures:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const refreshUserData = async () => {
    if (state.user) {
      await fetchExtendedUserData(state.user.id, state.session);
    } else {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();
      if (activeSession?.user) {
        await fetchExtendedUserData(activeSession.user.id, activeSession);
      }
    }
  };

  useEffect(() => {
    // first load: use the session saved on the phone (AsyncStorage). Any failure -> stop loading.
    withTimeout(supabase.auth.getSession(), LOAD_TIMEOUT_MS)
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          await fetchExtendedUserData(session.user.id, session);
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      })
      .catch((error) => {
        console.error("getSession failed:", error);
        setState((prev) => ({ ...prev, loading: false }));
      });

    // Do NOT await Supabase calls inside this callback: the library holds a lock while it runs,
    // and a query that needs the same lock would wait forever (dead-lock). Hand the work to
    // setTimeout so it runs after the callback returns.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return; // already handled by getSession() above
      if (session?.user) {
        setTimeout(() => {
          fetchExtendedUserData(session.user.id, session);
        }, 0);
      } else {
        clearState();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  //console.log(state.session?.user.id);
  //console.log(state.profile);
  const isAdmin = state.profile?.role === "admin";
  const homeRoute = "/(app)/(tabs)/forum";

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAdmin,
        homeRoute,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
