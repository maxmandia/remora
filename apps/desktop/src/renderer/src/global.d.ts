import type { AuthBridge } from "../../shared/auth.ts";
import type { DesktopAttachmentMediaBridge } from "../../shared/attachment-media.ts";
import type { DesktopUpdateBridge } from "../../shared/desktop-update.ts";
import type { DesktopNavigationBridge } from "../../shared/navigation.ts";
import type { DesktopRealtimeBridge } from "../../shared/realtime.ts";
import type { DesktopTrpcBridge } from "../../shared/trpc.ts";

declare global {
  interface Window {
    remoraAuth: AuthBridge;
    remoraAttachmentMedia: DesktopAttachmentMediaBridge;
    remoraDesktopUpdate: DesktopUpdateBridge;
    remoraNavigation: DesktopNavigationBridge;
    remoraRealtime: DesktopRealtimeBridge;
    remoraTrpc: DesktopTrpcBridge;
  }
}

export {};
