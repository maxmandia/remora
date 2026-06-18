import type { AuthBridge } from "../../shared/auth.ts";
import type { DesktopReferenceMediaBridge } from "../../shared/reference-media.ts";
import type { DesktopRealtimeBridge } from "../../shared/realtime.ts";
import type { DesktopTrpcBridge } from "../../shared/trpc.ts";

declare global {
  interface Window {
    remoraAuth: AuthBridge;
    remoraReferenceMedia: DesktopReferenceMediaBridge;
    remoraRealtime: DesktopRealtimeBridge;
    remoraTrpc: DesktopTrpcBridge;
  }
}

export {};
