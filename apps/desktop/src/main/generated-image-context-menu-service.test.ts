import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generatedImageChannel } from "../shared/generated-image.ts";

import type {
  BrowserWindow,
  DownloadItem,
  MenuItemConstructorOptions,
  Session,
  WebContents,
} from "electron";

const electronMocks = vi.hoisted(() => ({
  dialog: {
    showMessageBox: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
  Menu: {
    buildFromTemplate: vi.fn(),
  },
}));

vi.mock("electron", () => electronMocks);
vi.mock("./auth-service.ts", () => ({
  getStoredSessionCookie: vi.fn(),
}));
vi.mock("./env.ts", () => ({
  env: {
    DESKTOP_API_ORIGIN: "https://api.example.test",
  },
}));
vi.mock("./observability.ts", () => ({
  captureDesktopException: vi.fn(),
  wrapIpcHandler: (_channel: string, handler: (...args: never[]) => unknown) =>
    handler,
}));

describe("GeneratedImageContextMenuService", () => {
  const services: Array<{ dispose(): void }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const service of services.splice(0)) {
      service.dispose();
    }
  });

  it("opens a one-item native menu for the active Remora window", async () => {
    const harness = await createHarness();

    await harness.showContextMenu("job_1");

    expect(electronMocks.Menu.buildFromTemplate).toHaveBeenCalledWith([
      expect.objectContaining({ label: "Save Image As…" }),
    ]);
    expect(harness.popup).toHaveBeenCalledWith({ window: harness.window });
  });

  it("rejects invalid requests and requests from another renderer", async () => {
    const harness = await createHarness();

    await expect(harness.invoke({ jobId: "../job" })).rejects.toThrow(
      "Generated image job id was invalid",
    );
    await expect(
      harness.invoke({ jobId: "job_1" }, { id: 999 } as WebContents),
    ).rejects.toThrow("did not come from Remora");
  });

  it("fetches a fresh authenticated URL and configures the native filename", async () => {
    const harness = await createHarness({ contentType: "image/png" });

    await harness.showContextMenu("job_1");
    harness.clickSave();
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

    expect(harness.fetch).toHaveBeenCalledWith(
      new URL(
        "https://api.example.test/api/generation/jobs/job_1/image-download-url",
      ),
      { headers: { cookie: "session=abc" } },
    );
    expect(harness.downloadURL).toHaveBeenCalledWith(
      "https://signed.example/image",
    );

    const download = harness.startDownload();

    expect(download.setSaveDialogOptions).toHaveBeenCalledWith({
      defaultPath: "remora-image-job_1.png",
      title: "Save Image As",
    });
  });

  it("derives supported extensions and omits unknown extensions", async () => {
    for (const [contentType, suffix] of [
      ["image/jpeg", ".jpg"],
      ["image/webp", ".webp"],
      ["image/bmp", ".bmp"],
      ["image/gif", ".gif"],
      ["image/avif", ".avif"],
      ["application/octet-stream", ""],
    ]) {
      const harness = await createHarness({ contentType });

      await harness.showContextMenu("job_1");
      harness.clickSave();
      await vi.waitFor(() => expect(harness.downloadURL).toHaveBeenCalled());
      const download = harness.startDownload({
        mimeType:
          contentType === "application/octet-stream"
            ? "application/octet-stream"
            : "image/jpeg",
      });

      expect(download.setSaveDialogOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: `remora-image-job_1${suffix}`,
        }),
      );
    }
  });

  it("uses the downloaded MIME type when storage has no recognized type", async () => {
    const harness = await createHarness({
      contentType: "application/octet-stream",
    });

    await harness.showContextMenu("job_1");
    harness.clickSave();
    await vi.waitFor(() => expect(harness.downloadURL).toHaveBeenCalled());
    const download = harness.startDownload({ mimeType: "image/webp" });

    expect(download.setSaveDialogOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: "remora-image-job_1.webp",
      }),
    );
  });

  it("does not intercept unrelated downloads", async () => {
    const harness = await createHarness();

    await harness.showContextMenu("job_1");
    harness.clickSave();
    await vi.waitFor(() => expect(harness.downloadURL).toHaveBeenCalled());
    const download = harness.startDownload({
      url: "https://signed.example/video",
    });

    expect(download.setSaveDialogOptions).not.toHaveBeenCalled();
  });

  it("treats cancellation silently and reports interruption natively", async () => {
    const harness = await createHarness();

    await harness.showContextMenu("job_1");
    harness.clickSave();
    await vi.waitFor(() => expect(harness.downloadURL).toHaveBeenCalled());
    const cancelled = harness.startDownload();

    cancelled.finish("cancelled");
    expect(electronMocks.dialog.showMessageBox).not.toHaveBeenCalled();

    await harness.showContextMenu("job_2");
    harness.clickSave();
    await vi.waitFor(() =>
      expect(harness.downloadURL).toHaveBeenCalledTimes(2),
    );
    const interrupted = harness.startDownload();

    interrupted.finish("interrupted");
    expect(electronMocks.dialog.showMessageBox).toHaveBeenCalledWith(
      harness.window,
      expect.objectContaining({
        type: "error",
        message: "The image download was interrupted.",
      }),
    );
  });

  async function createHarness({
    contentType = "image/jpeg",
  }: {
    contentType?: string;
  } = {}) {
    const { GeneratedImageContextMenuService } =
      await import("./generated-image-context-menu-service.ts");
    const session = new EventEmitter() as Session;
    const webContentsEvents = new EventEmitter();
    const downloadURL = vi.fn();
    const webContents = Object.assign(webContentsEvents, {
      id: 7,
      isDestroyed: vi.fn(() => false),
      session,
      downloadURL,
    }) as unknown as WebContents;
    const window = {
      isDestroyed: vi.fn(() => false),
      webContents,
    } as unknown as BrowserWindow;
    const popup = vi.fn();
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            url: "https://signed.example/image",
            contentType,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const service = new GeneratedImageContextMenuService(() => window, {
      apiOrigin: "https://api.example.test",
      fetch: fetch as typeof globalThis.fetch,
      getSessionCookie: async () => "session=abc",
    });

    electronMocks.Menu.buildFromTemplate.mockReturnValue({ popup });
    service.setup();
    services.push(service);

    const invoke = (
      request: unknown,
      sender: WebContents = webContents,
    ): Promise<unknown> => {
      const handler = [...electronMocks.ipcMain.handle.mock.calls]
        .reverse()
        .find(
          ([channel]) =>
            channel === `${generatedImageChannel}:show-context-menu`,
        )?.[1];

      if (!handler) {
        throw new Error("Generated image IPC handler was not registered");
      }

      return Promise.resolve().then(() => handler({ sender }, request));
    };

    return {
      downloadURL,
      fetch,
      invoke,
      popup,
      window,
      async showContextMenu(jobId: string) {
        await invoke({ jobId });
      },
      clickSave() {
        const template = electronMocks.Menu.buildFromTemplate.mock
          .lastCall?.[0] as MenuItemConstructorOptions[] | undefined;
        const item = template?.find(
          (candidate) => candidate.label === "Save Image As…",
        );

        if (!item) {
          throw new Error("Save Image As menu item was not found");
        }

        item.click?.({} as never, window, {} as never);
      },
      startDownload({
        url = "https://signed.example/image",
        mimeType = "image/jpeg",
      }: {
        url?: string;
        mimeType?: string;
      } = {}) {
        const events = new EventEmitter();
        const setSaveDialogOptions = vi.fn();
        const item = Object.assign(events, {
          getMimeType: vi.fn(() => mimeType),
          getURL: vi.fn(() => url),
          setSaveDialogOptions,
        }) as unknown as DownloadItem;

        session.emit("will-download", {}, item, webContents);

        return {
          setSaveDialogOptions,
          finish(state: "cancelled" | "completed" | "interrupted") {
            events.emit("done", {}, state);
          },
        };
      },
    };
  }
});
