import type { AuthBridge } from '../../shared/auth.ts'
import type { DesktopTrpcBridge } from '../../shared/trpc.ts'

declare global {
  interface Window {
    remoraAuth: AuthBridge
    remoraTrpc: DesktopTrpcBridge
  }
}

export {}
