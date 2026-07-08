import type { DesktopUpdateBridge } from "../../../shared/desktop-update.ts";

export const desktopUpdateBridge: DesktopUpdateBridge = {
  getState: () =>
    window.remoraDesktopUpdate?.getState() ??
    Promise.resolve({ status: "disabled" }),
  installReadyUpdate: () =>
    window.remoraDesktopUpdate?.installReadyUpdate() ?? Promise.resolve(false),
  onStateChange: (callback) =>
    window.remoraDesktopUpdate?.onStateChange(callback) ?? (() => undefined),
};

export type {
  DesktopUpdateBridge,
  DesktopUpdateState,
} from "../../../shared/desktop-update.ts";
