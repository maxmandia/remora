import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import {
  authChannel,
  type AuthBridge,
  type AuthErrorContext,
  type AuthUser,
} from "../shared/auth.ts";
import {
  trpcChannel,
  type DesktopTrpcBridge,
  type DesktopTrpcFetchRequest,
} from "../shared/trpc.ts";
import {
  isRealtimeClientEvent,
  realtimeChannel,
  type DesktopRealtimeBridge,
  type RealtimeConnectionStatus,
} from "../shared/realtime.ts";
import {
  attachmentMediaChannel,
  type DesktopAttachmentMediaBridge,
  type DesktopAttachmentMediaUploadRequest,
} from "../shared/attachment-media.ts";
import {
  isDesktopNavigationTarget,
  navigationChannel,
  type DesktopNavigationBridge,
} from "../shared/navigation.ts";
import {
  desktopUpdateChannel,
  isDesktopUpdateState,
  type DesktopUpdateBridge,
} from "../shared/desktop-update.ts";

export function setupPreloadBridge(): void {
  const remoraAuth: AuthBridge = {
    getUser: () => ipcRenderer.invoke(`${authChannel}:get-user`),
    requestAuth: () => ipcRenderer.invoke(`${authChannel}:request-auth`),
    signOut: () => ipcRenderer.invoke(`${authChannel}:sign-out`),
    onAuthenticated(callback) {
      const listener = (_event: IpcRendererEvent, user: AuthUser) => {
        callback(user);
      };

      ipcRenderer.on(`${authChannel}:authenticated`, listener);

      return () => {
        ipcRenderer.off(`${authChannel}:authenticated`, listener);
      };
    },
    onUserUpdated(callback) {
      const listener = (_event: IpcRendererEvent, user: AuthUser | null) => {
        callback(user);
      };

      ipcRenderer.on(`${authChannel}:user-updated`, listener);

      return () => {
        ipcRenderer.off(`${authChannel}:user-updated`, listener);
      };
    },
    onAuthError(callback) {
      const listener = (_event: IpcRendererEvent, context: AuthErrorContext) => {
        callback(context);
      };

      ipcRenderer.on(`${authChannel}:error`, listener);

      return () => {
        ipcRenderer.off(`${authChannel}:error`, listener);
      };
    },
  };

  const remoraTrpc: DesktopTrpcBridge = {
    fetch: (request: DesktopTrpcFetchRequest) =>
      ipcRenderer.invoke(`${trpcChannel}:fetch`, request),
  };

  const remoraAttachmentMedia: DesktopAttachmentMediaBridge = {
    upload: (request: DesktopAttachmentMediaUploadRequest) =>
      ipcRenderer.invoke(`${attachmentMediaChannel}:upload`, request),
  };

  const remoraRealtime: DesktopRealtimeBridge = {
    connect: () => ipcRenderer.invoke(`${realtimeChannel}:connect`),
    disconnect: () => ipcRenderer.invoke(`${realtimeChannel}:disconnect`),
    onEvent(callback) {
      const listener = (_event: IpcRendererEvent, event: unknown) => {
        if (isRealtimeClientEvent(event)) {
          callback(event);
        }
      };

      ipcRenderer.on(`${realtimeChannel}:event`, listener);

      return () => {
        ipcRenderer.off(`${realtimeChannel}:event`, listener);
      };
    },
    onConnectionChange(callback) {
      const listener = (
        _event: IpcRendererEvent,
        status: RealtimeConnectionStatus,
      ) => {
        if (status === "connected" || status === "disconnected") {
          callback(status);
        }
      };

      ipcRenderer.on(`${realtimeChannel}:connection-change`, listener);

      return () => {
        ipcRenderer.off(`${realtimeChannel}:connection-change`, listener);
      };
    },
  };

  const remoraNavigation: DesktopNavigationBridge = {
    onNavigate(callback) {
      const listener = (_event: IpcRendererEvent, target: unknown) => {
        if (isDesktopNavigationTarget(target)) {
          callback(target);
        }
      };

      ipcRenderer.on(`${navigationChannel}:navigate`, listener);

      return () => {
        ipcRenderer.off(`${navigationChannel}:navigate`, listener);
      };
    },
  };

  const remoraDesktopUpdate: DesktopUpdateBridge = {
    getState: () => ipcRenderer.invoke(`${desktopUpdateChannel}:get-state`),
    installReadyUpdate: () =>
      ipcRenderer.invoke(`${desktopUpdateChannel}:install-ready-update`),
    onStateChange(callback) {
      const listener = (_event: IpcRendererEvent, state: unknown) => {
        if (isDesktopUpdateState(state)) {
          callback(state);
        }
      };

      ipcRenderer.on(`${desktopUpdateChannel}:state-change`, listener);

      return () => {
        ipcRenderer.off(`${desktopUpdateChannel}:state-change`, listener);
      };
    },
  };

  contextBridge.exposeInMainWorld("remoraAuth", remoraAuth);
  contextBridge.exposeInMainWorld(
    "remoraAttachmentMedia",
    remoraAttachmentMedia,
  );
  contextBridge.exposeInMainWorld("remoraDesktopUpdate", remoraDesktopUpdate);
  contextBridge.exposeInMainWorld("remoraNavigation", remoraNavigation);
  contextBridge.exposeInMainWorld("remoraTrpc", remoraTrpc);
  contextBridge.exposeInMainWorld("remoraRealtime", remoraRealtime);
}
