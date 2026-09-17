import { Session, User } from "@supabase/supabase-js";

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  personalData: any | null;
  onboardingStatus: 'not_started' | 'skipped' | 'completed';
  loading: boolean;
};
