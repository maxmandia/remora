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
import { env } from "./env.ts";
import { setupAttachmentMediaUploadService } from "./attachment-media-upload-service.ts";
import { setupRealtimeService } from "./realtime-desktop-service.ts";
import { setupTrpcService } from "./trpc-service.ts";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const TITLE_BAR_OVERLAY_HEIGHT = 44;
const WINDOW_ICON_FILE_NAME = "icon.png";

if (started) {
  app.quit();
}

app.setName(env.DESKTOP_APP_NAME);

let mainWindow: BrowserWindow | null = null;

setupAuthService(() => mainWindow);
setupTrpcService();
setupAttachmentMediaUploadService();
const realtimeService = setupRealtimeService(() => mainWindow);

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

  mainWindow = new BrowserWindow({
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

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void handleExternalUrl(url);

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL();

    if (!currentUrl || url === currentUrl) {
      return;
    }

    event.preventDefault();
    void handleExternalUrl(url);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
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
  void realtimeService.disconnect();
});
