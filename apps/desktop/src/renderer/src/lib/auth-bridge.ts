import type { AuthBridge } from '../../../shared/auth.ts'

export const authBridge: AuthBridge = {
  getUser: () => window.remoraAuth.getUser(),
  requestAuth: () => window.remoraAuth.requestAuth(),
  signOut: () => window.remoraAuth.signOut(),
  onAuthenticated: (callback) => window.remoraAuth.onAuthenticated(callback),
  onUserUpdated: (callback) => window.remoraAuth.onUserUpdated(callback),
  onAuthError: (callback) => window.remoraAuth.onAuthError(callback),
}

export type { AuthErrorContext, AuthBridge, AuthUser } from '../../../shared/auth.ts'
