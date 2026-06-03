import type { AuthUser } from '@remora/backend/types'

export const authChannel = 'remora-auth'

export type { AuthUser }

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
