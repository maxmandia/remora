import type { AuthBridge } from "../../../shared/auth.ts";

export const authBridge: AuthBridge = {
  getState: () => window.remoraAuth.getState(),
  listUsers: (input) => window.remoraAuth.listUsers(input),
  impersonateUser: (userId) => window.remoraAuth.impersonateUser(userId),
  stopImpersonating: () => window.remoraAuth.stopImpersonating(),
  requestAuth: () => window.remoraAuth.requestAuth(),
  signOut: () => window.remoraAuth.signOut(),
  onAuthenticated: (callback) => window.remoraAuth.onAuthenticated(callback),
  onUserUpdated: (callback) => window.remoraAuth.onUserUpdated(callback),
  onAuthError: (callback) => window.remoraAuth.onAuthError(callback),
};

export type {
  AuthErrorContext,
  AuthBridge,
  AuthState,
} from "../../../shared/auth.ts";
