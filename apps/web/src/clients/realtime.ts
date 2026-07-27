import { parseRealtimeClientEvent } from "@remora/realtime";

import { apiOrigin } from "../lib/api-origin";

import type {
  RealtimeClient,
  RealtimeClientEvent,
  RealtimeConnectionStatus,
} from "@remora/realtime";

type RealtimeScheduler = {
  setTimeout: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
};

type BrowserLifecycle = {
  isOnline: () => boolean;
  isVisible: () => boolean;
  onOnline: (callback: () => void) => () => void;
  onOffline: (callback: () => void) => () => void;
  onVisibilityChange: (callback: () => void) => () => void;
};

type BrowserRealtimeClientOptions = {
  apiOrigin: string;
  browserLifecycle?: BrowserLifecycle;
  scheduler?: RealtimeScheduler;
  websocketFactory?: (url: string) => WebSocket;
};

const websocketConnectingReadyState = 0;
const websocketOpenReadyState = 1;
const initialReconnectDelayMs = 250;
const maxReconnectDelayMs = 5_000;

export class BrowserRealtimeClient implements RealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof globalThis.setTimeout> | null =
    null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private status: RealtimeConnectionStatus = "disconnected";
  private removeBrowserLifecycleListeners: (() => void) | null = null;

  private readonly eventListeners = new Set<
    (event: RealtimeClientEvent) => void
  >();
  private readonly connectionListeners = new Set<
    (status: RealtimeConnectionStatus) => void
  >();
  private readonly browserLifecycle: BrowserLifecycle;
  private readonly scheduler: RealtimeScheduler;
  private readonly websocketFactory: (url: string) => WebSocket;
  private readonly websocketUrl: string;

  constructor(options: BrowserRealtimeClientOptions) {
    this.browserLifecycle = options.browserLifecycle ?? defaultBrowserLifecycle;
    this.scheduler = options.scheduler ?? {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
    this.websocketFactory =
      options.websocketFactory ?? ((url) => new WebSocket(url));
    this.websocketUrl = createRealtimeWebSocketUrl(options.apiOrigin);
  }

  async connect() {
    this.shouldReconnect = true;
    this.addBrowserLifecycleListeners();
    this.retryNow();
  }

  async disconnect() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.removeBrowserLifecycleListeners?.();
    this.removeBrowserLifecycleListeners = null;

    const socket = this.socket;

    this.socket = null;

    if (
      socket &&
      (socket.readyState === websocketOpenReadyState ||
        socket.readyState === websocketConnectingReadyState)
    ) {
      socket.close(1000, "Realtime disconnected");
    }

    this.setStatus("disconnected");
  }

  onEvent(callback: (event: RealtimeClientEvent) => void) {
    this.eventListeners.add(callback);

    return () => {
      this.eventListeners.delete(callback);
    };
  }

  onConnectionChange(callback: (status: RealtimeConnectionStatus) => void) {
    this.connectionListeners.add(callback);

    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  private openSocket() {
    if (!this.shouldReconnect || !this.browserLifecycle.isOnline()) {
      return;
    }

    if (
      this.socket?.readyState === websocketOpenReadyState ||
      this.socket?.readyState === websocketConnectingReadyState
    ) {
      return;
    }

    let socket: WebSocket;

    try {
      socket = this.websocketFactory(this.websocketUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.socket !== socket) {
        return;
      }

      this.reconnectAttempt = 0;
      this.setStatus("connected");
    });
    socket.addEventListener("message", (message) => {
      if (this.socket !== socket || typeof message.data !== "string") {
        return;
      }

      const event = parseRealtimeMessage(message.data);

      if (!event) {
        return;
      }

      for (const listener of this.eventListeners) {
        listener(event);
      }
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) {
        return;
      }

      this.socket = null;
      this.setStatus("disconnected");
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      if (this.socket === socket) {
        socket.close();
      }
    });
  }

  private scheduleReconnect() {
    if (
      this.reconnectTimer ||
      !this.shouldReconnect ||
      !this.browserLifecycle.isOnline()
    ) {
      return;
    }

    const delayMs = Math.min(
      maxReconnectDelayMs,
      initialReconnectDelayMs * 2 ** this.reconnectAttempt,
    );

    this.reconnectAttempt += 1;
    this.reconnectTimer = this.scheduler.setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delayMs);
  }

  private retryNow() {
    if (
      !this.shouldReconnect ||
      !this.browserLifecycle.isOnline() ||
      this.isSocketActive()
    ) {
      return;
    }

    this.clearReconnectTimer();
    this.openSocket();
  }

  private isSocketActive() {
    return (
      this.socket?.readyState === websocketOpenReadyState ||
      this.socket?.readyState === websocketConnectingReadyState
    );
  }

  private addBrowserLifecycleListeners() {
    if (this.removeBrowserLifecycleListeners) {
      return;
    }

    const unsubscribeOnline = this.browserLifecycle.onOnline(() => {
      this.retryNow();
    });
    const unsubscribeOffline = this.browserLifecycle.onOffline(() => {
      this.clearReconnectTimer();
    });
    const unsubscribeVisibility = this.browserLifecycle.onVisibilityChange(
      () => {
        if (this.browserLifecycle.isVisible()) {
          this.retryNow();
        }
      },
    );

    this.removeBrowserLifecycleListeners = () => {
      unsubscribeOnline();
      unsubscribeOffline();
      unsubscribeVisibility();
    };
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) {
      return;
    }

    this.scheduler.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(status: RealtimeConnectionStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;

    for (const listener of this.connectionListeners) {
      listener(status);
    }
  }
}

export function createRealtimeWebSocketUrl(origin: string) {
  const url = new URL("/api/realtime", origin);

  switch (url.protocol) {
    case "http:":
      url.protocol = "ws:";
      break;
    case "https:":
      url.protocol = "wss:";
      break;
    default:
      throw new Error(`Unsupported realtime API protocol: ${url.protocol}`);
  }

  return url.toString();
}

function parseRealtimeMessage(message: string) {
  try {
    return parseRealtimeClientEvent(JSON.parse(message));
  } catch {
    return null;
  }
}

const defaultBrowserLifecycle: BrowserLifecycle = {
  isOnline: () => navigator.onLine,
  isVisible: () => document.visibilityState === "visible",
  onOnline(callback) {
    window.addEventListener("online", callback);

    return () => {
      window.removeEventListener("online", callback);
    };
  },
  onOffline(callback) {
    window.addEventListener("offline", callback);

    return () => {
      window.removeEventListener("offline", callback);
    };
  },
  onVisibilityChange(callback) {
    document.addEventListener("visibilitychange", callback);

    return () => {
      document.removeEventListener("visibilitychange", callback);
    };
  },
};

export const realtimeClient = new BrowserRealtimeClient({
  apiOrigin,
});
