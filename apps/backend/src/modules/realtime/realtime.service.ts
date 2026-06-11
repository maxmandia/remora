import { realtimeRepository } from "./realtime.repository.ts";
import {
  serializeRealtimeClientEvent,
  toRealtimeClientEvent,
} from "./realtime.utils.ts";

import type {
  RealtimeEventSubscription,
  RealtimeRepository,
} from "./realtime.repository.ts";
import type { RealtimeInternalEvent } from "./realtime.types.ts";

const websocketOpenReadyState = 1;

export type RealtimeSocket = {
  readonly readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export class RealtimeService {
  private readonly socketsByUserId = new Map<string, Set<RealtimeSocket>>();
  private subscription: RealtimeEventSubscription | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(
    private readonly repository: RealtimeRepository = realtimeRepository,
  ) {}

  async start() {
    if (this.subscription) {
      return;
    }

    this.startPromise ??= this.repository
      .listenToInternalEvents((event) => {
        this.sendInternalEvent(event);
      })
      .then((subscription) => {
        this.subscription = subscription;
      })
      .finally(() => {
        this.startPromise = null;
      });

    await this.startPromise;
  }

  async stop() {
    const subscription = this.subscription;

    this.subscription = null;
    await subscription?.close();

    for (const socket of this.getAllSockets()) {
      socket.close(1001, "Realtime service stopping");
    }

    this.socketsByUserId.clear();
  }

  registerConnection({
    userId,
    socket,
  }: {
    userId: string;
    socket: RealtimeSocket;
  }) {
    const sockets = this.socketsByUserId.get(userId) ?? new Set();

    sockets.add(socket);
    this.socketsByUserId.set(userId, sockets);

    return () => {
      sockets.delete(socket);

      if (sockets.size === 0) {
        this.socketsByUserId.delete(userId);
      }
    };
  }

  private sendInternalEvent(event: RealtimeInternalEvent) {
    const sockets = this.socketsByUserId.get(event.userId);

    if (!sockets?.size) {
      return;
    }

    const message = serializeRealtimeClientEvent(toRealtimeClientEvent(event));

    for (const socket of Array.from(sockets)) {
      if (socket.readyState !== websocketOpenReadyState) {
        sockets.delete(socket);
        continue;
      }

      try {
        socket.send(message);
      } catch {
        sockets.delete(socket);
      }
    }

    if (sockets.size === 0) {
      this.socketsByUserId.delete(event.userId);
    }
  }

  private getAllSockets() {
    return Array.from(this.socketsByUserId.values()).flatMap((sockets) =>
      Array.from(sockets),
    );
  }
}

export const realtimeService = new RealtimeService();
