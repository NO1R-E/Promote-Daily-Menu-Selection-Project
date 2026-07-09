import { Session, User } from "@supabase/supabase-js";

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  personalData: any | null;
  hasCompletedOnboarding: boolean;
  loading: boolean;
};
