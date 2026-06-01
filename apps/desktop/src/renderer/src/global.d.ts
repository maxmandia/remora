import type { AuthBridge } from '../../shared/auth.ts'

declare global {
  interface Window {
    remoraAuth: AuthBridge
  }
}

export {}
