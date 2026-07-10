import type { BrowserWindow } from "electron";

export function getUsableBrowserWindow(window: BrowserWindow | null) {
  if (
    !window ||
    window.isDestroyed() ||
    window.webContents.isDestroyed()
  ) {
    return null;
  }

  return window;
}
