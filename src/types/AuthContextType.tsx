import { Session, User } from "@supabase/supabase-js";

export type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  personalData: any | null;
  loading: boolean;
  hasCompletedOnboarding: boolean;
  refreshUserData: () => Promise<void>;
};
