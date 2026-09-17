import { Href } from "@/.expo/types/router";
import { AuthState } from "./AuthState";

export type AuthContextType = AuthState & {
  isAdmin: boolean;
  homeRoute: Href;
  refreshUserData: () => Promise<void>;
};
