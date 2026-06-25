// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthContextType } from "../types/AuthContextType";

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [personalData, setPersonalData] = useState<any | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] =
    useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const fetchExtendedUserData = async (userId: string) => {
    try {
      // Fetch profile details
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // Fetch physical metrics/dietary limits
      const { data: metrics } = await supabase
        .from("personalData")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      setProfile(prof);
      setPersonalData(metrics);
      setHasCompletedOnboarding(!!metrics);
    } catch (error) {
      console.error("Error fetching extended user structures:", error);
    }
  };

  const refreshUserData = async () => {
    // If we call refresh, pass the active user state context down
    if (user) {
      await fetchExtendedUserData(user.id);
    } else {
      // Fallback fallback if called prematurely during auth transition frames
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();
      if (activeSession?.user) {
        await fetchExtendedUserData(activeSession.user.id);
      }
    }
  };

  useEffect(() => {
    // Check initial active token traces on app boot
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchExtendedUserData(session.user.id);
      }
      setLoading(false);
    });

    // Listen to live system broadcasts (Login, Register, Sign Out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchExtendedUserData(session.user.id);
      } else {
        // Clear all cached identities cleanly upon logging out
        setProfile(null);
        setPersonalData(null);
        setHasCompletedOnboarding(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        personalData,
        loading,
        hasCompletedOnboarding,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
