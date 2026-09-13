import { AuthState } from "./AuthState";

export type AuthContextType = AuthState & {
  isAdmin: boolean;
  refreshUserData: () => Promise<void>;
};
