import type { SerializedUser } from '@remora/auth'

export const authChannel = 'remora-auth'

export type AuthUser = SerializedUser

export type AuthErrorContext = {
  message?: string
  status?: number
  statusText?: string
  path?: string
}

export type AuthBridge = {
  getUser: () => Promise<AuthUser | null>
  requestAuth: () => Promise<void>
  signOut: () => Promise<void>
  onAuthenticated: (callback: (user: AuthUser) => unknown) => () => void
  onUserUpdated: (callback: (user: AuthUser | null) => unknown) => () => void
  onAuthError: (callback: (context: AuthErrorContext) => unknown) => () => void
}
