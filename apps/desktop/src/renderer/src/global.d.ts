import type { AuthBridge } from "../../shared/auth.ts";
import type { DesktopAttachmentMediaBridge } from "../../shared/attachment-media.ts";
import type { DesktopRealtimeBridge } from "../../shared/realtime.ts";
import type { DesktopTrpcBridge } from "../../shared/trpc.ts";

declare global {
  interface Window {
    remoraAuth: AuthBridge;
    remoraAttachmentMedia: DesktopAttachmentMediaBridge;
    remoraRealtime: DesktopRealtimeBridge;
    remoraTrpc: DesktopTrpcBridge;
  }
}

export {};
