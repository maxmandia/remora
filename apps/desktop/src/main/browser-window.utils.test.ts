import { describe, expect, it } from "vitest";

import { getUsableBrowserWindow } from "./browser-window.utils.ts";

import type { BrowserWindow } from "electron";

describe("getUsableBrowserWindow", () => {
  it("returns null when there is no window", () => {
    expect(getUsableBrowserWindow(null)).toBeNull();
  });

  it("returns null when the window is destroyed", () => {
    const window = createWindow({ windowIsDestroyed: true });

    expect(getUsableBrowserWindow(window)).toBeNull();
  });

  it("returns null when the window web contents are destroyed", () => {
    const window = createWindow({ webContentsAreDestroyed: true });

    expect(getUsableBrowserWindow(window)).toBeNull();
  });

  it("returns a live window", () => {
    const window = createWindow();

    expect(getUsableBrowserWindow(window)).toBe(window);
  });
});

function createWindow({
  webContentsAreDestroyed = false,
  windowIsDestroyed = false,
}: {
  webContentsAreDestroyed?: boolean;
  windowIsDestroyed?: boolean;
} = {}) {
  return {
    isDestroyed: () => windowIsDestroyed,
    webContents: {
      isDestroyed: () => webContentsAreDestroyed,
    },
  } as BrowserWindow;
}
