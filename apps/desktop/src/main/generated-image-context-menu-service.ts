import {
  dialog,
  ipcMain,
  Menu,
  type BrowserWindow,
  type DownloadItem,
  type IpcMainInvokeEvent,
  type Session,
  type WebContents,
} from "electron";

import { generatedImageChannel } from "../shared/generated-image.ts";
import { getStoredSessionCookie } from "./auth-service.ts";
import { env } from "./env.ts";
import { captureDesktopException, wrapIpcHandler } from "./observability.ts";

const pendingDownloadTimeoutMs = 30_000;
const generatedImageJobIdPattern = /^[A-Za-z0-9_-]{1,200}$/;

type GeneratedImageDownloadUrl = {
  url: string;
  contentType: string | null;
};

type PendingDownload = {
  id: number;
  webContentsId: number;
  jobId: string;
  url: string;
  contentType: string | null;
  timeout: NodeJS.Timeout;
};

type SessionListener = (
  event: Electron.Event,
  item: DownloadItem,
  webContents: WebContents,
) => void;

type GeneratedImageContextMenuServiceOptions = {
  apiOrigin?: string;
  fetch?: typeof globalThis.fetch;
  getSessionCookie?: () => Promise<string | null>;
};

export class GeneratedImageContextMenuService {
  private readonly apiOrigin: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly getSessionCookie: () => Promise<string | null>;
  private readonly pendingDownloads = new Map<number, PendingDownload>();
  private readonly sessionListeners = new Map<Session, SessionListener>();
  private readonly observedWebContentsIds = new Set<number>();
  private nextPendingDownloadId = 1;

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    options: GeneratedImageContextMenuServiceOptions = {},
  ) {
    this.apiOrigin = options.apiOrigin ?? env.DESKTOP_API_ORIGIN;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.getSessionCookie = options.getSessionCookie ?? getStoredSessionCookie;
  }

  setup(): void {
    const channel = `${generatedImageChannel}:show-context-menu`;

    ipcMain.handle(
      channel,
      wrapIpcHandler(channel, (event, request) =>
        this.showContextMenu(event, request),
      ),
    );
  }

  dispose(): void {
    ipcMain.removeHandler(`${generatedImageChannel}:show-context-menu`);

    for (const pending of this.pendingDownloads.values()) {
      clearTimeout(pending.timeout);
    }

    this.pendingDownloads.clear();
    this.observedWebContentsIds.clear();

    for (const [session, listener] of this.sessionListeners) {
      session.off("will-download", listener);
    }

    this.sessionListeners.clear();
  }

  private showContextMenu(event: IpcMainInvokeEvent, request: unknown): void {
    const window = this.getWindow();

    if (!window || event.sender.id !== window.webContents.id) {
      throw new Error("Generated image menu request did not come from Remora");
    }

    const jobId = this.parseJobId(request);
    const menu = Menu.buildFromTemplate([
      {
        label: "Save Image As…",
        click: () => {
          void this.saveImage(window, jobId).catch((error) => {
            this.reportSaveFailure(window, error);
          });
        },
      },
    ]);

    menu.popup({ window });
  }

  private parseJobId(request: unknown): string {
    if (
      typeof request !== "object" ||
      request === null ||
      !("jobId" in request) ||
      typeof request.jobId !== "string" ||
      !generatedImageJobIdPattern.test(request.jobId)
    ) {
      throw new Error("Generated image job id was invalid");
    }

    return request.jobId;
  }

  private async saveImage(window: BrowserWindow, jobId: string): Promise<void> {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      return;
    }

    const download = await this.createDownloadUrl(jobId);

    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      return;
    }

    const webContents = window.webContents;
    const pending = this.addPendingDownload(webContents, jobId, download);

    this.listenForDownloads(webContents.session);

    try {
      webContents.downloadURL(download.url);
    } catch (error) {
      this.removePendingDownload(pending.id);
      throw error;
    }
  }

  private async createDownloadUrl(
    jobId: string,
  ): Promise<GeneratedImageDownloadUrl> {
    const sessionCookie = await this.getSessionCookie();

    if (!sessionCookie) {
      throw new Error("Generated image download requires authentication");
    }

    const url = new URL(
      `/api/generation/jobs/${encodeURIComponent(jobId)}/image-download-url`,
      this.apiOrigin,
    );
    const response = await this.fetch(url, {
      headers: {
        cookie: sessionCookie,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Generated image download URL request failed with ${response.status}`,
      );
    }

    return this.parseDownloadUrl(await response.json());
  }

  private parseDownloadUrl(value: unknown): GeneratedImageDownloadUrl {
    if (
      typeof value !== "object" ||
      value === null ||
      !("url" in value) ||
      typeof value.url !== "string" ||
      !("contentType" in value) ||
      (value.contentType !== null && typeof value.contentType !== "string")
    ) {
      throw new Error("Generated image download URL response was invalid");
    }

    const url = new URL(value.url);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Generated image download URL protocol was invalid");
    }

    return {
      url: url.toString(),
      contentType: value.contentType,
    };
  }

  private addPendingDownload(
    webContents: WebContents,
    jobId: string,
    download: GeneratedImageDownloadUrl,
  ): PendingDownload {
    this.observeWebContents(webContents);
    const id = this.nextPendingDownloadId++;
    const pending: PendingDownload = {
      id,
      webContentsId: webContents.id,
      jobId,
      url: download.url,
      contentType: download.contentType,
      timeout: setTimeout(
        () => this.removePendingDownload(id),
        pendingDownloadTimeoutMs,
      ),
    };

    this.pendingDownloads.set(id, pending);
    return pending;
  }

  private observeWebContents(webContents: WebContents): void {
    if (this.observedWebContentsIds.has(webContents.id)) {
      return;
    }

    this.observedWebContentsIds.add(webContents.id);
    webContents.once("destroyed", () => {
      this.observedWebContentsIds.delete(webContents.id);

      for (const pending of this.pendingDownloads.values()) {
        if (pending.webContentsId === webContents.id) {
          this.removePendingDownload(pending.id);
        }
      }
    });
  }

  private listenForDownloads(session: Session): void {
    if (this.sessionListeners.has(session)) {
      return;
    }

    const listener: SessionListener = (_event, item, webContents) => {
      const pending = this.findPendingDownload(webContents.id, item.getURL());

      if (!pending) {
        return;
      }

      this.removePendingDownload(pending.id);
      item.setSaveDialogOptions({
        defaultPath: this.createFilename(
          pending.jobId,
          pending.contentType,
          item.getMimeType(),
        ),
        title: "Save Image As",
      });
      item.once("done", (_doneEvent, state) => {
        if (state !== "interrupted") {
          return;
        }

        const window = this.getWindow();

        if (!window || window.webContents.id !== pending.webContentsId) {
          return;
        }

        void dialog.showMessageBox(window, {
          type: "error",
          title: "Image Save Failed",
          message: "The image download was interrupted.",
          detail: "Please try saving the image again.",
        });
      });
    };

    session.on("will-download", listener);
    this.sessionListeners.set(session, listener);
  }

  private findPendingDownload(
    webContentsId: number,
    url: string,
  ): PendingDownload | null {
    for (const pending of this.pendingDownloads.values()) {
      if (pending.webContentsId === webContentsId && pending.url === url) {
        return pending;
      }
    }

    return null;
  }

  private removePendingDownload(id: number): void {
    const pending = this.pendingDownloads.get(id);

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingDownloads.delete(id);
  }

  private createFilename(
    jobId: string,
    storedContentType: string | null,
    downloadedContentType: string,
  ): string {
    const extension =
      getImageExtension(storedContentType) ??
      getImageExtension(downloadedContentType);

    return `remora-image-${jobId}${extension ? `.${extension}` : ""}`;
  }

  private reportSaveFailure(window: BrowserWindow, error: unknown): void {
    captureDesktopException(error, { feature: "generatedImageSave" });

    if (window.isDestroyed()) {
      return;
    }

    void dialog.showMessageBox(window, {
      type: "error",
      title: "Image Save Failed",
      message: "Remora could not save this image.",
      detail: "Please try again.",
    });
  }
}

function getImageExtension(contentType: string | null): string | null {
  switch (contentType?.split(";", 1)[0]?.trim().toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/bmp":
      return "bmp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return null;
  }
}

export function setupGeneratedImageContextMenuService(
  getWindow: () => BrowserWindow | null,
) {
  const service = new GeneratedImageContextMenuService(getWindow);

  service.setup();
  return service;
}
