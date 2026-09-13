// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import { AuthContextType } from "../types/AuthContextType";
import { AuthState } from "../types/AuthState";

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // 2. Group all variables into a single unified state block
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    personalData: null,
    hasCompletedOnboarding: false,
    loading: true,
  });

  // ใน AuthContext.tsx
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

    // 💡 ดึงข้อมูลจาก user_pref เพื่อดูว่ากรอกถึงขั้นตอนสุดท้ายหรือยัง
    const { data: prefData } = await supabase
      .from("user_pref")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1);

    // ถ้ามีข้อมูลใน user_pref (แม้จะเป็น Array ว่างเปล่าจากการลบ/บันทึก) 
    // ให้เช็กว่ามีรายการถูกกรอกแล้วหรือไม่
    const isCompleted = Array.isArray(prefData) && prefData.length > 0;

    setState({
      session: activeSession,
      user: activeSession?.user ?? null,
      profile: prof,
      personalData: metrics,
      hasCompletedOnboarding: isCompleted, // 👈 จะกลายเป็น true เมื่อกรอกถึงหน้า preference
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
    // Check initial active token traces on app boot
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await fetchExtendedUserData(session.user.id, session);
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    // Listen to live system broadcasts (Login, Register, Sign Out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchExtendedUserData(session.user.id, session);
      } else {
        // Clear all cached identities cleanly upon logging out in one pass
        setState({
          session: null,
          user: null,
          profile: null,
          personalData: null,
          hasCompletedOnboarding: false,
          loading: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  //console.log(state.session?.user.id);
  //console.log(state.profile);
  // 4. Derive administrative capabilities instantly from the grouped payload state
  const isAdmin = state.profile?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAdmin,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
