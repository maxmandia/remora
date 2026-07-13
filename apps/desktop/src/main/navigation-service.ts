import { app, BrowserWindow, ipcMain } from "electron";

import type { DesktopCallbackService } from "./desktop-callback-service.ts";
import { wrapIpcHandler } from "./observability.ts";
import {
  navigationChannel,
  type DesktopNavigationTarget,
} from "../shared/navigation.ts";

export function setupNavigationService(
  getWindow: () => BrowserWindow | null,
  callbackService: DesktopCallbackService,
) {
  const createCheckoutReturnUrlChannel = `${navigationChannel}:create-checkout-return-url`;

  ipcMain.handle(
    createCheckoutReturnUrlChannel,
    wrapIpcHandler(createCheckoutReturnUrlChannel, async () => {
      if (app.isPackaged) {
        return null;
      }

      const callbackUrl = await callbackService.createCheckoutCallback(
        (receivedUrl) => {
          const status = receivedUrl.searchParams.get("credit_checkout");

          if (status !== "success" && status !== "cancel") {
            throw new Error("Desktop checkout callback status was invalid");
          }

          focusWindow(getWindow());
          sendNavigationTarget(getWindow, { to: "/app/settings/credits" });
        },
      );

      return callbackUrl.toString();
    }),
  );
}

function sendNavigationTarget(
  getWindow: () => BrowserWindow | null,
  target: DesktopNavigationTarget,
) {
  const window = getWindow();

  if (!window) {
    void app.whenReady().then(() => sendNavigationTarget(getWindow, target));
    return;
  }

  const send = () => {
    window.webContents.send(`${navigationChannel}:navigate`, target);
  };

  if (window.webContents.isLoading()) {
    window.webContents.once("did-finish-load", send);
    return;
  }

  send();
}

function focusWindow(window: BrowserWindow | null) {
  if (!window) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
}
