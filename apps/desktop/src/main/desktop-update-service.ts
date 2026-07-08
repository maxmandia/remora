import type { DesktopChannel } from "@remora/env";
import {
  app,
  autoUpdater,
  ipcMain,
  type BrowserWindow,
  type FeedURLOptions,
} from "electron";

import { env } from "./env.ts";
import {
  captureDesktopException,
  wrapIpcHandler,
} from "./observability.ts";
import {
  desktopUpdateChannel,
  type DesktopUpdateState,
} from "../shared/desktop-update.ts";

type DesktopAutoUpdater = {
  checkForUpdates: () => void;
  quitAndInstall: () => void;
  setFeedURL: (options: FeedURLOptions) => void;
  on: (event: DesktopUpdateEvent, listener: DesktopUpdateListener) => unknown;
};

type DesktopUpdateEvent =
  | "checking-for-update"
  | "update-available"
  | "update-not-available"
  | "update-downloaded"
  | "error";

type DesktopUpdateListener = (...args: unknown[]) => void;

type DesktopUpdateScheduler = {
  setInterval: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof globalThis.setInterval>;
  clearInterval: (timer: ReturnType<typeof globalThis.setInterval>) => void;
};

type DesktopUpdateServiceOptions = {
  appIsPackaged: boolean;
  arch: string;
  channel: DesktopChannel;
  getWindow: () => BrowserWindow | null;
  platform: NodeJS.Platform;
  releasePublicBaseUrl: string | null;
  scheduler?: DesktopUpdateScheduler;
  updater?: DesktopAutoUpdater;
};

export const desktopUpdateCheckIntervalMs = 20 * 60 * 1000;

export class DesktopUpdateService {
  private readonly feedUrl: string | null;
  private readonly scheduler: DesktopUpdateScheduler;
  private readonly updater: DesktopAutoUpdater;
  private interval: ReturnType<typeof globalThis.setInterval> | null = null;
  private started = false;
  private state: DesktopUpdateState;

  constructor(private readonly options: DesktopUpdateServiceOptions) {
    this.feedUrl = createDesktopUpdateFeedUrl(options);
    this.scheduler = options.scheduler ?? {
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
    };
    this.updater =
      options.updater ?? (autoUpdater as unknown as DesktopAutoUpdater);
    this.state = this.feedUrl ? { status: "idle" } : { status: "disabled" };
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;

    if (!this.feedUrl) {
      this.setState({ status: "disabled" });
      return;
    }

    try {
      this.updater.setFeedURL({
        url: this.feedUrl,
        serverType: "json",
      });
      this.registerUpdaterListeners();
      this.checkForUpdates();
      this.interval = this.scheduler.setInterval(() => {
        this.checkForUpdates();
      }, desktopUpdateCheckIntervalMs);
    } catch (error) {
      this.captureUpdateError(error);
      this.setState({ status: "disabled" });
    }
  }

  dispose(): void {
    if (!this.interval) {
      return;
    }

    this.scheduler.clearInterval(this.interval);
    this.interval = null;
  }

  getState(): DesktopUpdateState {
    return this.state;
  }

  installReadyUpdate(): boolean {
    if (this.state.status !== "ready") {
      return false;
    }

    this.updater.quitAndInstall();

    return true;
  }

  private registerUpdaterListeners(): void {
    this.updater.on("checking-for-update", () => {
      this.setState({ status: "checking" });
    });
    this.updater.on("update-available", () => {
      this.setState({ status: "downloading" });
    });
    this.updater.on("update-not-available", () => {
      this.setState({ status: "idle" });
    });
    this.updater.on("update-downloaded", (...args) => {
      this.setState({
        status: "ready",
        version: getDownloadedUpdateVersion(args),
      });
    });
    this.updater.on("error", (error) => {
      this.handleUpdateError(error);
    });
  }

  private checkForUpdates(): void {
    if (!this.feedUrl || this.state.status !== "idle") {
      return;
    }

    this.setState({ status: "checking" });

    try {
      this.updater.checkForUpdates();
    } catch (error) {
      this.handleUpdateError(error);
    }
  }

  private handleUpdateError(error: unknown): void {
    this.captureUpdateError(error);

    if (this.feedUrl && this.state.status !== "ready") {
      this.setState({ status: "idle" });
    }
  }

  private captureUpdateError(error: unknown): void {
    captureDesktopException(error, {
      updateArch: this.options.arch,
      updateChannel: this.options.channel,
      updatePlatform: this.options.platform,
      updateState: this.state.status,
    });
  }

  private setState(state: DesktopUpdateState): void {
    if (isSameDesktopUpdateState(this.state, state)) {
      return;
    }

    this.state = state;
    this.options
      .getWindow()
      ?.webContents.send(`${desktopUpdateChannel}:state-change`, state);
  }
}

export function setupDesktopUpdateService(
  getWindow: () => BrowserWindow | null,
): DesktopUpdateService {
  const service = new DesktopUpdateService({
    appIsPackaged: app.isPackaged,
    arch: process.arch,
    channel: env.DESKTOP_CHANNEL,
    getWindow,
    platform: process.platform,
    releasePublicBaseUrl: env.DESKTOP_RELEASE_PUBLIC_BASE_URL,
  });

  const getStateChannel = `${desktopUpdateChannel}:get-state`;
  const installReadyUpdateChannel = `${desktopUpdateChannel}:install-ready-update`;

  ipcMain.handle(
    getStateChannel,
    wrapIpcHandler(getStateChannel, () => service.getState()),
  );
  ipcMain.handle(
    installReadyUpdateChannel,
    wrapIpcHandler(installReadyUpdateChannel, () =>
      service.installReadyUpdate(),
    ),
  );

  void app.whenReady().then(() => {
    service.start();
  });

  return service;
}

function createDesktopUpdateFeedUrl({
  appIsPackaged,
  arch,
  channel,
  platform,
  releasePublicBaseUrl,
}: Pick<
  DesktopUpdateServiceOptions,
  "appIsPackaged" | "arch" | "channel" | "platform" | "releasePublicBaseUrl"
>): string | null {
  if (
    !appIsPackaged ||
    platform !== "darwin" ||
    channel === "local" ||
    !releasePublicBaseUrl
  ) {
    return null;
  }

  return [
    releasePublicBaseUrl.replace(/\/+$/, ""),
    channel,
    "darwin",
    arch,
    "RELEASES.json",
  ].join("/");
}

function getDownloadedUpdateVersion(args: unknown[]): string | null {
  let releaseName: string | null = null;

  for (const arg of args) {
    if (typeof arg === "string") {
      releaseName = arg;
    }
  }

  if (!releaseName) {
    return null;
  }

  const versionMatch = /\bv(.+)$/.exec(releaseName);

  return versionMatch?.[1] ?? releaseName;
}

function isSameDesktopUpdateState(
  current: DesktopUpdateState,
  next: DesktopUpdateState,
): boolean {
  return (
    current.status === next.status &&
    (current.status !== "ready" ||
      next.status !== "ready" ||
      current.version === next.version)
  );
}
