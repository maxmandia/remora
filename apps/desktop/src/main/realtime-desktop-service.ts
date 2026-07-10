import { ipcMain, type BrowserWindow } from "electron";
import { WebSocket, type ClientOptions, type RawData } from "ws";

import { env } from "./env.ts";
import { getStoredSessionCookie } from "./auth-service.ts";
import { wrapIpcHandler } from "./observability.ts";
import {
  isRealtimeClientEvent,
  realtimeChannel,
  type RealtimeConnectionStatus,
} from "../shared/realtime.ts";

type RealtimeWebSocket = {
  readonly readyState: number;
  on: (
    event: "open" | "message" | "close" | "error",
    listener: (...args: unknown[]) => void,
  ) => RealtimeWebSocket;
  close: (code?: number, reason?: string) => void;
};

type RealtimeWebSocketFactory = (
  url: string,
  options: Pick<ClientOptions, "headers">,
) => RealtimeWebSocket;

type RealtimeScheduler = {
  setTimeout: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
};

type RealtimeDesktopServiceOptions = {
  apiOrigin: string;
  getSessionCookie: () => Promise<string | null>;
  getWindow: () => BrowserWindow | null;
  scheduler?: RealtimeScheduler;
  websocketFactory?: RealtimeWebSocketFactory;
};

const websocketConnectingReadyState = 0;
const websocketOpenReadyState = 1;
const initialReconnectDelayMs = 250;
const maxReconnectDelayMs = 5_000;

export class RealtimeDesktopService {
  private socket: RealtimeWebSocket | null = null;
  private reconnectTimer: ReturnType<typeof globalThis.setTimeout> | null =
    null;
  private reconnectAttempt = 0;
  private connectionRequestId = 0;
  private shouldReconnect = false;
  private status: RealtimeConnectionStatus = "disconnected";

  private readonly scheduler: RealtimeScheduler;
  private readonly websocketFactory: RealtimeWebSocketFactory;

  constructor(private readonly options: RealtimeDesktopServiceOptions) {
    this.scheduler = options.scheduler ?? {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
    this.websocketFactory =
      options.websocketFactory ??
      ((url, websocketOptions) => new WebSocket(url, websocketOptions));
  }

  async connect() {
    this.shouldReconnect = true;

    if (
      this.socket?.readyState === websocketOpenReadyState ||
      this.socket?.readyState === websocketConnectingReadyState
    ) {
      return;
    }

    await this.openSocket();
  }

  async disconnect() {
    this.shouldReconnect = false;
    this.connectionRequestId += 1;
    this.clearReconnectTimer();

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

  private async openSocket() {
    const requestId = ++this.connectionRequestId;
    const sessionCookie = await this.options.getSessionCookie();

    if (!this.shouldReconnect || requestId !== this.connectionRequestId) {
      return;
    }

    if (!sessionCookie) {
      this.setStatus("disconnected");
      return;
    }

    const socket = this.websocketFactory(this.createRealtimeWebSocketUrl(), {
      headers: {
        cookie: sessionCookie,
      },
    });

    this.socket = socket;

    socket.on("open", () => {
      if (this.socket !== socket) {
        return;
      }

      this.reconnectAttempt = 0;
      this.setStatus("connected");
    });

    socket.on("message", (data) => {
      this.handleMessage(socket, data as RawData);
    });

    socket.on("close", () => {
      this.handleClosedSocket(socket);
    });

    socket.on("error", () => {
      if (this.socket === socket) {
        socket.close();
      }
    });
  }

  private handleClosedSocket(socket: RealtimeWebSocket) {
    if (this.socket !== socket) {
      return;
    }

    this.socket = null;
    this.setStatus("disconnected");

    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }
  }

  private handleMessage(socket: RealtimeWebSocket, data: RawData) {
    if (this.socket !== socket) {
      return;
    }

    const event = parseRealtimeMessage(data);

    if (!event) {
      return;
    }

    this.options
      .getWindow()
      ?.webContents.send(`${realtimeChannel}:event`, event);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    const delayMs = Math.min(
      maxReconnectDelayMs,
      initialReconnectDelayMs * 2 ** this.reconnectAttempt,
    );

    this.reconnectAttempt += 1;
    this.reconnectTimer = this.scheduler.setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delayMs);
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
    this.options
      .getWindow()
      ?.webContents.send(`${realtimeChannel}:connection-change`, status);
  }

  private createRealtimeWebSocketUrl() {
    const url = new URL("/api/realtime", this.options.apiOrigin);

    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

    return url.toString();
  }
}

export function setupRealtimeService(getWindow: () => BrowserWindow | null) {
  const service = new RealtimeDesktopService({
    apiOrigin: env.DESKTOP_API_ORIGIN,
    getSessionCookie: getStoredSessionCookie,
    getWindow,
  });

  const connectChannel = `${realtimeChannel}:connect`;
  const disconnectChannel = `${realtimeChannel}:disconnect`;

  ipcMain.handle(
    connectChannel,
    wrapIpcHandler(connectChannel, () => service.connect()),
  );
  ipcMain.handle(
    disconnectChannel,
    wrapIpcHandler(disconnectChannel, () => service.disconnect()),
  );

  return service;
}

function parseRealtimeMessage(data: RawData) {
  try {
    const parsed = JSON.parse(toMessageText(data));

    return isRealtimeClientEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toMessageText(data: RawData) {
  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  return data.toString("utf8");
}
