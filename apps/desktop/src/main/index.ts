import {
  app,
  BrowserWindow,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";
import started from "electron-squirrel-startup";
import { existsSync } from "node:fs";
import path from "node:path";

import { setupAuthService } from "./auth-service.ts";
import { getUsableBrowserWindow } from "./browser-window.utils.ts";
import { env } from "./env.ts";
import { setupAttachmentMediaUploadService } from "./attachment-media-upload-service.ts";
import { initializeDesktopObservability } from "./observability.ts";
import { setupRealtimeService } from "./realtime-desktop-service.ts";
import { setupTrpcService } from "./trpc-service.ts";
import { setupDesktopUpdateService } from "./desktop-update-service.ts";
import { DesktopCallbackService } from "./desktop-callback-service.ts";
import { setupNavigationService } from "./navigation-service.ts";
import { setupTextEditingContextMenu } from "./text-editing-context-menu-service.ts";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const TITLE_BAR_OVERLAY_HEIGHT = 44;
const WINDOW_ICON_FILE_NAME = "icon.png";

if (started) {
  app.quit();
}

app.setName(env.DESKTOP_APP_NAME);
initializeDesktopObservability();

let mainWindow: BrowserWindow | null = null;
const desktopCallbackService = new DesktopCallbackService();

setupAuthService(getMainWindow, desktopCallbackService);
setupNavigationService(getMainWindow, desktopCallbackService);
setupTrpcService();
setupAttachmentMediaUploadService();
const realtimeService = setupRealtimeService(getMainWindow);
const desktopUpdateService = setupDesktopUpdateService(getMainWindow);

function getMainWindow() {
  return getUsableBrowserWindow(mainWindow);
}

function isAllowedExternalUrl(url: string) {
  try {
    const parsed = new URL(url);
    const webOrigin = new URL(env.WEB_ORIGIN).origin;
    const apiOrigin = new URL(env.DESKTOP_API_ORIGIN).origin;

    return (
      parsed.protocol === "https:" ||
      parsed.origin === webOrigin ||
      parsed.origin === apiOrigin
    );
  } catch {
    return false;
  }
}

async function handleExternalUrl(url: string) {
  if (!isAllowedExternalUrl(url)) {
    return;
  }

  await shell.openExternal(url);
}

function getWindowIconPath() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, WINDOW_ICON_FILE_NAME)
    : path.join(app.getAppPath(), "assets", WINDOW_ICON_FILE_NAME);

  return existsSync(iconPath) ? iconPath : undefined;
}

function getWindowVisualOptions(): Pick<
  BrowserWindowConstructorOptions,
  "backgroundColor" | "transparent" | "vibrancy" | "visualEffectState"
> {
  if (process.platform !== "darwin") {
    return { backgroundColor: "#14120b" };
  }

  return {
    backgroundColor: "#00000000",
    transparent: true,
    vibrancy: "sidebar",
    visualEffectState: "active",
  };
}

function createWindow() {
  const windowIconPath = getWindowIconPath();

  const window = new BrowserWindow({
    title: env.DESKTOP_APP_NAME,
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    ...getWindowVisualOptions(),
    show: false,
    titleBarStyle: "hiddenInset",
    titleBarOverlay: {
      height: TITLE_BAR_OVERLAY_HEIGHT,
    },
    ...(windowIconPath ? { icon: windowIconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  setupTextEditingContextMenu(window);

  window.once("ready-to-show", () => {
    window.show();
  });

  window.once("closed", () => {
    if (mainWindow !== window) {
      return;
    }

    mainWindow = null;
    void realtimeService.disconnect();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void handleExternalUrl(url);

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const currentUrl = window.webContents.getURL();

    if (!currentUrl || url === currentUrl) {
      return;
    }

    event.preventDefault();
    void handleExternalUrl(url);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

app.on("ready", () => {
  const windowIconPath = getWindowIconPath();

  if (process.platform === "darwin" && windowIconPath) {
    app.dock?.setIcon(windowIconPath);
  }

  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void desktopCallbackService.stop();
  void realtimeService.disconnect();
  desktopUpdateService.dispose();
});
