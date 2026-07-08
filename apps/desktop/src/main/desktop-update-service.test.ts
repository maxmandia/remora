import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesktopChannel } from "@remora/env";
import type { BrowserWindow } from "electron";

import { desktopUpdateChannel } from "../shared/desktop-update.ts";
import {
  DesktopUpdateService,
  desktopUpdateCheckIntervalMs,
} from "./desktop-update-service.ts";

const electronMocks = vi.hoisted(() => ({
  app: {
    isPackaged: true,
    whenReady: vi.fn(async () => undefined),
  },
  autoUpdater: {
    checkForUpdates: vi.fn(),
    on: vi.fn(),
    quitAndInstall: vi.fn(),
    setFeedURL: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

const observabilityMocks = vi.hoisted(() => ({
  captureDesktopException: vi.fn(),
  wrapIpcHandler: vi.fn((_channel, handler) => handler),
}));

vi.mock("electron", () => electronMocks);
vi.mock("./observability.ts", () => observabilityMocks);

describe("DesktopUpdateService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["unpackaged apps", { appIsPackaged: false }],
    ["non-macOS platforms", { platform: "win32" as NodeJS.Platform }],
    ["local channel builds", { channel: "local" as DesktopChannel }],
    ["missing release base URLs", { releasePublicBaseUrl: null }],
  ])("disables updates for %s", (_name, overrides) => {
    const harness = createHarness(overrides);

    harness.service.start();

    expect(harness.service.getState()).toEqual({ status: "disabled" });
    expect(harness.updater.setFeedURL).not.toHaveBeenCalled();
    expect(harness.updater.checkForUpdates).not.toHaveBeenCalled();
    expect(harness.scheduledIntervals).toEqual([]);
  });

  it("sets the stable feed URL and schedules recurring checks", () => {
    const harness = createHarness({
      releasePublicBaseUrl: "https://updates.example.test/",
    });

    harness.service.start();

    expect(harness.updater.setFeedURL).toHaveBeenCalledWith({
      url: "https://updates.example.test/stable/darwin/arm64/RELEASES.json",
      serverType: "json",
    });
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(harness.scheduledIntervals).toEqual([
      {
        callback: expect.any(Function),
        delayMs: desktopUpdateCheckIntervalMs,
      },
    ]);

    harness.updater.emit("update-not-available");
    harness.scheduledIntervals[0]?.callback();

    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("sets the nightly feed URL", () => {
    const harness = createHarness({
      channel: "nightly",
    });

    harness.service.start();

    expect(harness.updater.setFeedURL).toHaveBeenCalledWith({
      url: "https://updates.example.test/nightly/darwin/arm64/RELEASES.json",
      serverType: "json",
    });
  });

  it("emits checking, downloading, and ready states", () => {
    const harness = createHarness();

    harness.service.start();
    harness.updater.emit("update-available");
    harness.updater.emit(
      "update-downloaded",
      {},
      "Release notes",
      "Remora v0.2.3",
    );

    expect(harness.sentMessages).toEqual([
      [`${desktopUpdateChannel}:state-change`, { status: "checking" }],
      [`${desktopUpdateChannel}:state-change`, { status: "downloading" }],
      [
        `${desktopUpdateChannel}:state-change`,
        { status: "ready", version: "0.2.3" },
      ],
    ]);
  });

  it("ignores overlapping checks while an update check is active", () => {
    const harness = createHarness();

    harness.service.start();
    harness.scheduledIntervals[0]?.callback();

    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it("installs only after an update is ready", () => {
    const harness = createHarness();

    harness.service.start();

    expect(harness.service.installReadyUpdate()).toBe(false);
    expect(harness.updater.quitAndInstall).not.toHaveBeenCalled();

    harness.updater.emit("update-downloaded", {}, "", "Remora v0.2.3");

    expect(harness.service.installReadyUpdate()).toBe(true);
    expect(harness.updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it("captures updater errors and returns to idle", () => {
    const harness = createHarness();
    const error = new Error("Update failed");

    harness.service.start();
    harness.updater.emit("error", error);

    expect(observabilityMocks.captureDesktopException).toHaveBeenCalledWith(
      error,
      {
        updateArch: "arm64",
        updateChannel: "stable",
        updatePlatform: "darwin",
        updateState: "checking",
      },
    );
    expect(harness.service.getState()).toEqual({ status: "idle" });
    expect(harness.sentMessages).toEqual([
      [`${desktopUpdateChannel}:state-change`, { status: "checking" }],
      [`${desktopUpdateChannel}:state-change`, { status: "idle" }],
    ]);
  });
});

function createHarness(
  overrides: Partial<{
    appIsPackaged: boolean;
    arch: string;
    channel: DesktopChannel;
    platform: NodeJS.Platform;
    releasePublicBaseUrl: string | null;
  }> = {},
) {
  const updater = new FakeDesktopAutoUpdater();
  const sentMessages: unknown[][] = [];
  const scheduledIntervals: Array<{
    callback: () => void;
    delayMs: number;
  }> = [];
  const service = new DesktopUpdateService({
    appIsPackaged: overrides.appIsPackaged ?? true,
    arch: overrides.arch ?? "arm64",
    channel: overrides.channel ?? "stable",
    getWindow: () =>
      ({
        webContents: {
          send: (...args: unknown[]) => {
            sentMessages.push(args);
          },
        },
      }) as BrowserWindow,
    platform: overrides.platform ?? "darwin",
    releasePublicBaseUrl: Object.hasOwn(overrides, "releasePublicBaseUrl")
      ? (overrides.releasePublicBaseUrl ?? null)
      : "https://updates.example.test",
    scheduler: {
      setInterval(callback, delayMs) {
        scheduledIntervals.push({ callback, delayMs });

        return scheduledIntervals.length as unknown as ReturnType<
          typeof setInterval
        >;
      },
      clearInterval(timer) {
        const index = Number(timer) - 1;

        if (scheduledIntervals[index]) {
          scheduledIntervals.splice(index, 1);
        }
      },
    },
    updater,
  });

  return {
    scheduledIntervals,
    sentMessages,
    service,
    updater,
  };
}

class FakeDesktopAutoUpdater {
  readonly checkForUpdates = vi.fn();
  readonly quitAndInstall = vi.fn();
  readonly setFeedURL = vi.fn();

  private readonly listeners = new Map<
    string,
    Array<(...args: unknown[]) => void>
  >();

  on(event: string, listener: (...args: unknown[]) => void) {
    const listeners = this.listeners.get(event) ?? [];

    listeners.push(listener);
    this.listeners.set(event, listeners);

    return this;
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}
