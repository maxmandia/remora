import { describe, expect, it, vi } from "vitest";

import { realtimeChannel } from "../shared/realtime.ts";
import { RealtimeDesktopService } from "./realtime-desktop-service.ts";

import type { BrowserWindow } from "electron";

const electronMocks = vi.hoisted(() => ({
  ipcMain: {
    handle: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    decryptString: vi.fn(),
    encryptString: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
  app: {
    setAsDefaultProtocolClient: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: vi.fn(async () => undefined),
  },
}));
const sentryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  init: vi.fn(),
  isInitialized: vi.fn(() => false),
  setUser: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock("electron", () => electronMocks);
vi.mock("@sentry/electron/main", () => sentryMocks);

describe("RealtimeDesktopService", () => {
  it("opens a websocket with the stored session cookie", async () => {
    const harness = createHarness();

    await harness.service.connect();

    expect(harness.sockets[0]?.url).toBe(
      "ws://localhost:4000/api/realtime",
    );
    expect(harness.sockets[0]?.options.headers).toEqual({
      cookie: "better-auth.session_token=signed-token",
    });

    harness.sockets[0]?.open();

    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
    ]);
  });

  it("forwards valid realtime events to the renderer", async () => {
    const harness = createHarness();

    await harness.service.connect();
    harness.sockets[0]?.open();
    harness.sockets[0]?.message("{");
    harness.sockets[0]?.message(
      JSON.stringify({
        id: "generation.job.succeeded:job_1",
        type: "generation.job.succeeded",
        occurredAt: "2026-06-05T00:00:00.000Z",
        payload: {
          jobId: "job_1",
          threadId: "thread_1",
        },
      }),
    );

    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
      [
        `${realtimeChannel}:event`,
        {
          id: "generation.job.succeeded:job_1",
          type: "generation.job.succeeded",
          occurredAt: "2026-06-05T00:00:00.000Z",
          payload: {
            jobId: "job_1",
            threadId: "thread_1",
          },
        },
      ],
    ]);
  });

  it("reconnects after unexpected socket closes", async () => {
    const harness = createHarness();

    await harness.service.connect();
    harness.sockets[0]?.open();
    harness.sockets[0]?.close();

    expect(harness.scheduledTimers[0]?.delayMs).toBe(250);

    harness.scheduledTimers[0]?.callback();
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.sockets).toHaveLength(2);

    harness.sockets[1]?.open();

    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
      [`${realtimeChannel}:connection-change`, "disconnected"],
      [`${realtimeChannel}:connection-change`, "connected"],
    ]);
  });

  it("does not reconnect after intentional disconnects", async () => {
    const harness = createHarness();

    await harness.service.connect();
    harness.sockets[0]?.open();
    await harness.service.disconnect();

    expect(harness.sockets[0]?.closeCalls).toEqual([
      {
        code: 1000,
        reason: "Realtime disconnected",
      },
    ]);
    expect(harness.scheduledTimers).toEqual([]);
    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
      [`${realtimeChannel}:connection-change`, "disconnected"],
    ]);

    harness.sockets[0]?.emitClose();

    expect(harness.scheduledTimers).toEqual([]);
    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
      [`${realtimeChannel}:connection-change`, "disconnected"],
    ]);
  });

  it("disconnects without sending to a missing renderer", async () => {
    const harness = createHarness();

    await harness.service.connect();
    harness.sockets[0]?.open();
    harness.removeWindow();

    await expect(harness.service.disconnect()).resolves.toBeUndefined();

    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
    ]);
    expect(harness.scheduledTimers).toEqual([]);
  });

  it("handles active socket closes without a renderer", async () => {
    const harness = createHarness();

    await harness.service.connect();
    harness.sockets[0]?.open();
    harness.removeWindow();

    expect(() => harness.sockets[0]?.close()).not.toThrow();

    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
    ]);
    expect(harness.scheduledTimers[0]?.delayMs).toBe(250);
  });

  it("ignores close events from replaced sockets", async () => {
    const harness = createHarness({ deferSocketClose: true });

    await harness.service.connect();
    harness.sockets[0]?.open();
    await harness.service.disconnect();
    await harness.service.connect();
    harness.sockets[1]?.open();

    harness.sockets[0]?.emitClose();

    expect(harness.scheduledTimers).toEqual([]);
    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
      [`${realtimeChannel}:connection-change`, "disconnected"],
      [`${realtimeChannel}:connection-change`, "connected"],
    ]);
  });

  it("ignores messages from replaced sockets", async () => {
    const harness = createHarness({ deferSocketClose: true });

    await harness.service.connect();
    harness.sockets[0]?.open();
    await harness.service.disconnect();
    await harness.service.connect();
    harness.sockets[1]?.open();

    harness.sockets[0]?.message(
      JSON.stringify({
        id: "generation.job.succeeded:job_1",
        type: "generation.job.succeeded",
        occurredAt: "2026-06-05T00:00:00.000Z",
        payload: {
          jobId: "job_1",
          threadId: "thread_1",
        },
      }),
    );

    expect(harness.sentMessages).toEqual([
      [`${realtimeChannel}:connection-change`, "connected"],
      [`${realtimeChannel}:connection-change`, "disconnected"],
      [`${realtimeChannel}:connection-change`, "connected"],
    ]);
  });
});

function createHarness({
  deferSocketClose = false,
}: {
  deferSocketClose?: boolean;
} = {}) {
  const sentMessages: unknown[][] = [];
  const sockets: FakeRealtimeSocket[] = [];
  const scheduledTimers: Array<{
    callback: () => void;
    delayMs: number;
  }> = [];
  let windowAvailable = true;
  const window = {
    webContents: {
      send: (...args: unknown[]) => {
        sentMessages.push(args);
      },
    },
  } as BrowserWindow;
  const service = new RealtimeDesktopService({
    apiOrigin: "http://localhost:4000",
    getSessionCookie: async () => "better-auth.session_token=signed-token",
    getWindow: () => (windowAvailable ? window : null),
    scheduler: {
      setTimeout(callback, delayMs) {
        scheduledTimers.push({ callback, delayMs });

        return scheduledTimers.length as unknown as ReturnType<
          typeof setTimeout
        >;
      },
      clearTimeout(timer) {
        const index = Number(timer) - 1;

        if (scheduledTimers[index]) {
          scheduledTimers.splice(index, 1);
        }
      },
    },
    websocketFactory: (url, options) => {
      const socket = new FakeRealtimeSocket(url, options, deferSocketClose);

      sockets.push(socket);

      return socket;
    },
  });

  return {
    removeWindow() {
      windowAvailable = false;
    },
    scheduledTimers,
    sentMessages,
    service,
    sockets,
  };
}

type FakeRealtimeSocketListener = (...args: unknown[]) => void;

class FakeRealtimeSocket {
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  readyState = 0;

  private readonly listeners = new Map<string, FakeRealtimeSocketListener[]>();

  constructor(
    readonly url: string,
    readonly options: {
      headers?: Record<string, string>;
    },
    private readonly deferClose: boolean,
  ) {}

  on(event: string, listener: FakeRealtimeSocketListener) {
    const listeners = this.listeners.get(event) ?? [];

    listeners.push(listener);
    this.listeners.set(event, listeners);

    return this;
  }

  open() {
    this.readyState = 1;
    this.emit("open");
  }

  message(data: string) {
    this.emit("message", Buffer.from(data));
  }

  close(code?: number, reason?: string) {
    this.closeCalls.push({ code, reason });
    this.readyState = 3;

    if (!this.deferClose) {
      this.emitClose();
    }
  }

  emitClose() {
    this.emit("close");
  }

  private emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}
