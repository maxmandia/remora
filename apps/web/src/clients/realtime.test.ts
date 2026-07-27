import { describe, expect, it } from "vitest";

import { BrowserRealtimeClient, createRealtimeWebSocketUrl } from "./realtime";

import type {
  RealtimeClientEvent,
  RealtimeConnectionStatus,
} from "@remora/realtime";

describe("createRealtimeWebSocketUrl", () => {
  it("maps HTTP API origins to WebSocket URLs", () => {
    expect(createRealtimeWebSocketUrl("http://localhost:4000")).toBe(
      "ws://localhost:4000/api/realtime",
    );
  });

  it("maps HTTPS API origins to secure WebSocket URLs", () => {
    expect(createRealtimeWebSocketUrl("https://api.remora.example")).toBe(
      "wss://api.remora.example/api/realtime",
    );
  });

  it("rejects unsupported API protocols", () => {
    expect(() =>
      createRealtimeWebSocketUrl("ftp://api.remora.example"),
    ).toThrow("Unsupported realtime API protocol: ftp:");
  });
});

describe("BrowserRealtimeClient", () => {
  it("connects idempotently and reports connection changes", async () => {
    const harness = createHarness();
    const statuses: RealtimeConnectionStatus[] = [];

    harness.client.onConnectionChange((status) => {
      statuses.push(status);
    });

    await harness.client.connect();
    await harness.client.connect();

    expect(harness.sockets).toHaveLength(1);
    expect(harness.sockets[0]?.url).toBe("ws://localhost:4000/api/realtime");

    harness.sockets[0]?.open();

    expect(statuses).toEqual(["connected"]);
  });

  it("stops reporting connection changes after unsubscribing", async () => {
    const harness = createHarness();
    const statuses: RealtimeConnectionStatus[] = [];
    const unsubscribe = harness.client.onConnectionChange((status) => {
      statuses.push(status);
    });

    await harness.client.connect();
    harness.sockets[0]?.open();
    unsubscribe();
    harness.sockets[0]?.unexpectedClose();

    expect(statuses).toEqual(["connected"]);
  });

  it("delivers valid events and ignores unsupported messages", async () => {
    const harness = createHarness();
    const events: RealtimeClientEvent[] = [];
    const unsubscribe = harness.client.onEvent((event) => {
      events.push(event);
    });

    await harness.client.connect();
    harness.sockets[0]?.message("{");
    harness.sockets[0]?.message(
      JSON.stringify({
        id: "billing.profile.updated:user_1",
        type: "billing.profile.updated",
        occurredAt: "2026-07-24T00:00:00.000Z",
        payload: {},
      }),
    );
    harness.sockets[0]?.message(new ArrayBuffer(4));
    harness.sockets[0]?.message(JSON.stringify(generationSucceededEvent));

    expect(events).toEqual([generationSucceededEvent]);

    unsubscribe();
    harness.sockets[0]?.message(JSON.stringify(generationSucceededEvent));

    expect(events).toEqual([generationSucceededEvent]);
  });

  it("reconnects unexpected closures with capped exponential backoff", async () => {
    const harness = createHarness();
    const delays: number[] = [];

    await harness.client.connect();

    for (let attempt = 0; attempt < 7; attempt += 1) {
      harness.sockets.at(-1)?.unexpectedClose();
      delays.push(harness.timers[0]?.delayMs ?? -1);
      harness.runNextTimer();
    }

    expect(delays).toEqual([250, 500, 1_000, 2_000, 4_000, 5_000, 5_000]);
    expect(harness.sockets).toHaveLength(8);
  });

  it("retries socket construction failures without rejecting connect", async () => {
    const harness = createHarness({ socketCreationFailures: 1 });

    await expect(harness.client.connect()).resolves.toBeUndefined();

    expect(harness.sockets).toEqual([]);
    expect(harness.timers[0]?.delayMs).toBe(250);

    harness.runNextTimer();

    expect(harness.sockets).toHaveLength(1);
  });

  it("cancels delayed reconnects when explicitly connected again", async () => {
    const harness = createHarness();

    await harness.client.connect();
    harness.sockets[0]?.unexpectedClose();

    expect(harness.timers).toHaveLength(1);

    await harness.client.connect();

    expect(harness.timers).toEqual([]);
    expect(harness.sockets).toHaveLength(2);
  });

  it("resets reconnect backoff after opening successfully", async () => {
    const harness = createHarness();

    await harness.client.connect();
    harness.sockets[0]?.unexpectedClose();
    harness.runNextTimer();
    harness.sockets[1]?.unexpectedClose();

    expect(harness.timers[0]?.delayMs).toBe(500);

    harness.runNextTimer();
    harness.sockets[2]?.open();
    harness.sockets[2]?.unexpectedClose();

    expect(harness.timers[0]?.delayMs).toBe(250);
  });

  it("closes errors and reconnects through the close path", async () => {
    const harness = createHarness();

    await harness.client.connect();
    harness.sockets[0]?.error();

    expect(harness.sockets[0]?.closeCalls).toEqual([
      {
        code: undefined,
        reason: undefined,
      },
    ]);
    expect(harness.timers[0]?.delayMs).toBe(250);
  });

  it("disconnects intentionally and cancels pending reconnects", async () => {
    const harness = createHarness();
    const statuses: RealtimeConnectionStatus[] = [];

    harness.client.onConnectionChange((status) => {
      statuses.push(status);
    });

    await harness.client.connect();
    harness.sockets[0]?.open();
    harness.sockets[0]?.unexpectedClose();

    expect(harness.timers).toHaveLength(1);

    await harness.client.disconnect();

    expect(harness.timers).toEqual([]);
    expect(statuses).toEqual(["connected", "disconnected"]);
    expect(harness.lifecycleListenerCount()).toBe(0);
  });

  it("closes active sockets with an intentional close reason", async () => {
    const harness = createHarness();

    await harness.client.connect();
    await harness.client.disconnect();

    expect(harness.sockets[0]?.closeCalls).toEqual([
      {
        code: 1000,
        reason: "Realtime disconnected",
      },
    ]);
    expect(harness.timers).toEqual([]);
  });

  it("ignores events from sockets replaced across disconnects", async () => {
    const harness = createHarness({ deferSocketClose: true });
    const events: RealtimeClientEvent[] = [];

    harness.client.onEvent((event) => {
      events.push(event);
    });

    await harness.client.connect();
    const replacedSocket = harness.sockets[0];
    await harness.client.disconnect();
    await harness.client.connect();
    harness.sockets[1]?.open();

    replacedSocket?.message(JSON.stringify(generationSucceededEvent));
    replacedSocket?.emitClose();

    expect(events).toEqual([]);
    expect(harness.timers).toEqual([]);
    expect(harness.sockets).toHaveLength(2);
  });

  it("waits for the browser to come online before connecting", async () => {
    const harness = createHarness({ online: false });

    await harness.client.connect();

    expect(harness.sockets).toEqual([]);

    harness.goOnline();

    expect(harness.sockets).toHaveLength(1);
  });

  it("pauses reconnect timers while offline and resumes immediately online", async () => {
    const harness = createHarness();

    await harness.client.connect();
    harness.sockets[0]?.unexpectedClose();

    expect(harness.timers).toHaveLength(1);

    harness.goOffline();

    expect(harness.timers).toEqual([]);

    harness.goOnline();

    expect(harness.sockets).toHaveLength(2);
  });

  it("recovers a disconnected visible tab without replacing a healthy socket", async () => {
    const harness = createHarness({ visible: false });

    await harness.client.connect();
    harness.sockets[0]?.unexpectedClose();

    expect(harness.timers).toHaveLength(1);

    harness.setVisible(true);

    expect(harness.timers).toEqual([]);
    expect(harness.sockets).toHaveLength(2);

    harness.sockets[1]?.open();
    harness.setVisible(false);
    harness.setVisible(true);

    expect(harness.sockets).toHaveLength(2);
  });

  it("removes browser lifecycle listeners when disconnected", async () => {
    const harness = createHarness();

    await harness.client.connect();

    expect(harness.lifecycleListenerCount()).toBe(3);

    await harness.client.disconnect();

    expect(harness.lifecycleListenerCount()).toBe(0);
  });
});

const generationSucceededEvent: RealtimeClientEvent = {
  id: "generation.job.succeeded:job_1",
  type: "generation.job.succeeded",
  occurredAt: "2026-07-24T00:00:00.000Z",
  payload: {
    jobId: "job_1",
    threadId: "thread_1",
  },
};

function createHarness({
  deferSocketClose = false,
  online = true,
  socketCreationFailures = 0,
  visible = true,
}: {
  deferSocketClose?: boolean;
  online?: boolean;
  socketCreationFailures?: number;
  visible?: boolean;
} = {}) {
  const sockets: FakeWebSocket[] = [];
  const timers: Array<{
    callback: () => void;
    delayMs: number;
    id: number;
  }> = [];
  const onlineListeners = new Set<() => void>();
  const offlineListeners = new Set<() => void>();
  const visibilityListeners = new Set<() => void>();
  let isOnline = online;
  let isVisible = visible;
  let nextTimerId = 1;
  let remainingSocketCreationFailures = socketCreationFailures;
  const client = new BrowserRealtimeClient({
    apiOrigin: "http://localhost:4000",
    browserLifecycle: {
      isOnline: () => isOnline,
      isVisible: () => isVisible,
      onOnline: createSubscription(onlineListeners),
      onOffline: createSubscription(offlineListeners),
      onVisibilityChange: createSubscription(visibilityListeners),
    },
    scheduler: {
      setTimeout(callback, delayMs) {
        const id = nextTimerId;

        nextTimerId += 1;
        timers.push({ callback, delayMs, id });

        return id as unknown as ReturnType<typeof globalThis.setTimeout>;
      },
      clearTimeout(timer) {
        const timerId = timer as unknown as number;
        const index = timers.findIndex(({ id }) => id === timerId);

        if (index >= 0) {
          timers.splice(index, 1);
        }
      },
    },
    websocketFactory: (url) => {
      if (remainingSocketCreationFailures > 0) {
        remainingSocketCreationFailures -= 1;
        throw new Error("Unable to construct WebSocket");
      }

      const socket = new FakeWebSocket(url, deferSocketClose);

      sockets.push(socket);

      return socket as unknown as WebSocket;
    },
  });

  return {
    client,
    goOffline() {
      isOnline = false;

      for (const listener of offlineListeners) {
        listener();
      }
    },
    goOnline() {
      isOnline = true;

      for (const listener of onlineListeners) {
        listener();
      }
    },
    lifecycleListenerCount() {
      return (
        onlineListeners.size + offlineListeners.size + visibilityListeners.size
      );
    },
    runNextTimer() {
      const timer = timers.shift();

      timer?.callback();
    },
    setVisible(nextVisible: boolean) {
      isVisible = nextVisible;

      for (const listener of visibilityListeners) {
        listener();
      }
    },
    sockets,
    timers,
  };
}

function createSubscription(listeners: Set<() => void>) {
  return (callback: () => void) => {
    listeners.add(callback);

    return () => {
      listeners.delete(callback);
    };
  };
}

type FakeWebSocketListener = (event: { data?: unknown }) => void;

class FakeWebSocket {
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  readyState = 0;

  private readonly listeners = new Map<string, FakeWebSocketListener[]>();

  constructor(
    readonly url: string,
    private readonly deferClose: boolean,
  ) {}

  addEventListener(event: string, listener: FakeWebSocketListener) {
    const listeners = this.listeners.get(event) ?? [];

    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  open() {
    this.readyState = 1;
    this.emit("open");
  }

  message(data: unknown) {
    this.emit("message", { data });
  }

  error() {
    this.emit("error");
  }

  close(code?: number, reason?: string) {
    this.closeCalls.push({ code, reason });
    this.readyState = 3;

    if (!this.deferClose) {
      this.emitClose();
    }
  }

  unexpectedClose() {
    this.readyState = 3;
    this.emitClose();
  }

  emitClose() {
    this.emit("close");
  }

  private emit(event: string, value: { data?: unknown } = {}) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(value);
    }
  }
}
