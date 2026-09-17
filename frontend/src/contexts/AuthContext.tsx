// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { AuthContextType } from "../types/AuthContextType";
import { AuthState } from "../types/AuthState";

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    personalData: null,
    onboardingStatus: 'not_started',
    loading: true,
  });

  const fetchExtendedUserData = async (userId: string, activeSession: any) => {
    try {
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .eq("profile_id", userId)
        .single();

      const { data: metrics } = await supabase
        .from("personalData")
        .select("*")
        .eq("personal_id", userId)
        .maybeSingle();

      const { data: prefData } = await supabase
        .from("user_pref")
        .select("user_id")
        .eq("user_id", userId)
        .limit(1);

      setState({
        session: activeSession,
        user: activeSession?.user ?? null,
        profile: prof,
        personalData: metrics,
        onboardingStatus: prof?.onboarding_status || 'not_started',
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await fetchExtendedUserData(session.user.id, session);
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchExtendedUserData(session.user.id, session);
      } else {
        setState({
          session: null,
          user: null,
          profile: null,
          personalData: null,
          onboardingStatus: 'not_started',
          loading: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  //console.log(state.session?.user.id);
  //console.log(state.profile);
  const isAdmin = state.profile?.role === "admin";

  const homeRoute = isAdmin
  ? "/(admin)/tempScreen"
  : "/(app)/(tabs)/chatbot";

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
