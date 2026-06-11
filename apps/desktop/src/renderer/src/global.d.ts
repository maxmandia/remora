import type { AuthBridge } from "../../shared/auth.ts";
import type { DesktopRealtimeBridge } from "../../shared/realtime.ts";
import type { DesktopTrpcBridge } from "../../shared/trpc.ts";

declare global {
  interface Window {
    remoraAuth: AuthBridge;
    remoraRealtime: DesktopRealtimeBridge;
    remoraTrpc: DesktopTrpcBridge;
  }
}

export {};
