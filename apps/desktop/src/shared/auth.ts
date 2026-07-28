import type {
  AccountImpersonationSearchField,
  AccountImpersonationUser,
} from "@remora/app/admin";
import type { AuthState } from "@remora/backend/types";

export const authChannel = "remora-auth";

export type { AuthState };

export type AuthErrorContext = {
  message?: string;
  status?: number;
  statusText?: string;
  path?: string;
};

export type AuthBridge = {
  getState: () => Promise<AuthState | null>;
  listUsers: (input: {
    searchField: AccountImpersonationSearchField;
    searchValue: string;
    limit: number;
    offset: number;
  }) => Promise<{ users: AccountImpersonationUser[]; total: number }>;
  impersonateUser: (userId: string) => Promise<AuthState>;
  stopImpersonating: () => Promise<AuthState>;
  requestAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  onAuthenticated: (callback: (state: AuthState) => unknown) => () => void;
  onUserUpdated: (callback: (state: AuthState | null) => unknown) => () => void;
  onAuthError: (callback: (context: AuthErrorContext) => unknown) => () => void;
};
