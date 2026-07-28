import {
  dialog,
  ipcMain,
  Menu,
  type BrowserWindow,
  type DownloadItem,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
  type Session,
  type WebContents,
} from "electron";
import type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";
import { maxGenerationAttachmentMediaUploadBytes } from "@remora/domain/generation-attachment-media/dto";

import {
  generatedImageChannel,
  type DesktopGeneratedImageContextMenuResult,
  type DesktopGeneratedImageRoleChoice,
} from "../shared/generated-image.ts";
import { getStoredAuthCookieHeader } from "./auth-service.ts";
import { env } from "./env.ts";
import { captureDesktopException, wrapIpcHandler } from "./observability.ts";

const pendingDownloadTimeoutMs = 30_000;
const generatedImageJobIdPattern = /^[A-Za-z0-9_-]{1,200}$/;
const attachmentMediaRoles = new Set<AttachmentMediaRole>([
  "reference",
  "firstFrame",
  "lastFrame",
]);
const attachmentMediaRoleOrder = new Map<AttachmentMediaRole, number>([
  ["reference", 0],
  ["firstFrame", 1],
  ["lastFrame", 2],
]);

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
    this.getSessionCookie =
      options.getSessionCookie ?? getStoredAuthCookieHeader;
  }

  setup(): void {
    const contextMenuChannel = `${generatedImageChannel}:show-context-menu`;
    const loadFileChannel = `${generatedImageChannel}:load-file`;

    ipcMain.handle(
      contextMenuChannel,
      wrapIpcHandler(contextMenuChannel, (event, request) =>
        this.showContextMenu(event, request),
      ),
    );
    ipcMain.handle(
      loadFileChannel,
      wrapIpcHandler(loadFileChannel, (event, request) =>
        this.loadFile(event, request),
      ),
    );
  }

  dispose(): void {
    ipcMain.removeHandler(`${generatedImageChannel}:show-context-menu`);
    ipcMain.removeHandler(`${generatedImageChannel}:load-file`);

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

  private showContextMenu(
    event: IpcMainInvokeEvent,
    request: unknown,
  ): Promise<DesktopGeneratedImageContextMenuResult> {
    const window = this.getWindow();

    if (!window || event.sender.id !== window.webContents.id) {
      throw new Error("Generated image menu request did not come from Remora");
    }

    const jobId = this.parseJobId(request);
    const roleChoices = this.parseRoleChoices(request);

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (result: DesktopGeneratedImageContextMenuResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };
      const menu = Menu.buildFromTemplate([
        ...roleChoices.map((choice) => ({
          label: getAttachmentMediaRoleMenuLabel(choice.role),
          enabled: !choice.disabled,
          click: () => finish({ role: choice.role }),
        })),
        ...(roleChoices.length > 0
          ? ([{ type: "separator" }] satisfies MenuItemConstructorOptions[])
          : []),
        {
          label: "Save Image As…",
          click: () => {
            finish(null);
            void this.saveImage(window, jobId).catch((error) => {
              this.reportSaveFailure(window, error);
            });
          },
        },
      ]);

      menu.popup({ window, callback: () => finish(null) });
    });
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

  private parseRoleChoices(
    request: unknown,
  ): DesktopGeneratedImageRoleChoice[] {
    if (
      typeof request !== "object" ||
      request === null ||
      !("roleChoices" in request) ||
      !Array.isArray(request.roleChoices)
    ) {
      throw new Error("Generated image role choices were invalid");
    }

    const seenRoles = new Set<AttachmentMediaRole>();

    return request.roleChoices
      .map((choice) => {
        if (
          typeof choice !== "object" ||
          choice === null ||
          !("role" in choice) ||
          typeof choice.role !== "string" ||
          !attachmentMediaRoles.has(choice.role as AttachmentMediaRole) ||
          !("disabled" in choice) ||
          typeof choice.disabled !== "boolean" ||
          seenRoles.has(choice.role as AttachmentMediaRole)
        ) {
          throw new Error("Generated image role choices were invalid");
        }

        const role = choice.role as AttachmentMediaRole;

        seenRoles.add(role);
        return { disabled: choice.disabled, role };
      })
      .sort(
        (left, right) =>
          (attachmentMediaRoleOrder.get(left.role) ?? 0) -
          (attachmentMediaRoleOrder.get(right.role) ?? 0),
      );
  }

  private async loadFile(
    event: IpcMainInvokeEvent,
    request: unknown,
  ): Promise<{
    contentType: string;
    data: ArrayBuffer;
    fileName: string;
  }> {
    const window = this.getWindow();

    if (!window || event.sender.id !== window.webContents.id) {
      throw new Error("Generated image file request did not come from Remora");
    }

    const jobId = this.parseJobId(request);
    const sessionCookie = await this.getSessionCookie();

    if (!sessionCookie) {
      throw new Error("Generated image file loading requires authentication");
    }

    const response = await this.fetch(
      new URL(
        `/api/generation/jobs/${encodeURIComponent(jobId)}/image-file`,
        this.apiOrigin,
      ),
      { headers: { cookie: sessionCookie } },
    );

    if (!response.ok) {
      throw new Error(
        `Generated image file request failed with ${response.status}`,
      );
    }

    const declaredLength = Number(response.headers.get("content-length"));

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maxGenerationAttachmentMediaUploadBytes
    ) {
      throw new Error("Generated image file was too large");
    }

    const data = await response.arrayBuffer();

    if (data.byteLength > maxGenerationAttachmentMediaUploadBytes) {
      throw new Error("Generated image file was too large");
    }

    const contentType =
      response.headers.get("content-type") ?? "application/octet-stream";

    return {
      contentType,
      data,
      fileName:
        getContentDispositionFilename(
          response.headers.get("content-disposition"),
        ) ?? this.createFilename(jobId, contentType, contentType),
    };
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

function getAttachmentMediaRoleMenuLabel(role: AttachmentMediaRole) {
  switch (role) {
    case "reference":
      return "Use as reference";
    case "firstFrame":
      return "Use as first frame";
    case "lastFrame":
      return "Use as last frame";
  }
}

function getContentDispositionFilename(value: string | null) {
  const match = value?.match(/filename="([^"]+)"/i);
  const filename = match?.[1]?.trim();

  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(filename)
  ) {
    return null;
  }

  return filename;
}

export function setupGeneratedImageContextMenuService(
  getWindow: () => BrowserWindow | null,
) {
  const service = new GeneratedImageContextMenuService(getWindow);

  service.setup();
  return service;
}
