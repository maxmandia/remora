import { describe, expect, it, vi } from "vitest";

import { RealtimeRepository } from "./realtime.repository.ts";
import { RealtimeService, type RealtimeSocket } from "./realtime.service.ts";
import { realtimeNotificationChannel } from "./realtime.types.ts";
import {
  createGenerationJobSucceededRealtimeInternalEvent,
  parseRealtimeInternalEvent,
  serializeRealtimeInternalEvent,
  toRealtimeClientEvent,
} from "./realtime.utils.ts";

import type { RealtimeInternalEvent } from "./realtime.types.ts";

describe("realtime events", () => {
  it("serializes and parses generation success internal events", () => {
    const event = createRealtimeEvent();
    const payload = serializeRealtimeInternalEvent(event);

    expect(parseRealtimeInternalEvent(payload)).toEqual(event);
    expect(parseRealtimeInternalEvent("{")).toBeNull();
    expect(
      parseRealtimeInternalEvent(
        JSON.stringify({
          ...event,
          userId: "",
        }),
      ),
    ).toBeNull();
    expect(
      parseRealtimeInternalEvent(
        JSON.stringify({
          ...event,
          type: "credits.balance.updated",
          id: "credits.balance.updated:user_1",
          payload: {
            balance: 100,
          },
        }),
      ),
    ).toBeNull();
    expect(
      parseRealtimeInternalEvent(
        JSON.stringify({
          ...event,
          payload: {
            jobId: "",
            threadId: event.payload.threadId,
          },
        }),
      ),
    ).toBeNull();
    expect(toRealtimeClientEvent(event)).toEqual({
      id: "generation.job.succeeded:job_1",
      type: "generation.job.succeeded",
      occurredAt: "2026-06-05T00:00:00.000Z",
      payload: {
        jobId: "job_1",
        threadId: "thread_1",
      },
    });
  });
});

describe("RealtimeRepository", () => {
  it("publishes internal events to the realtime notification channel", async () => {
    const notify = vi.fn(async () => undefined);
    const repository = new RealtimeRepository({
      notify,
      listen: vi.fn(),
    });
    const event = createRealtimeEvent();

    await repository.publishInternalEvent(event);

    expect(notify).toHaveBeenCalledWith(
      realtimeNotificationChannel,
      serializeRealtimeInternalEvent(event),
    );
  });

  it("parses valid notifications and ignores malformed payloads", async () => {
    const notifyListeners: Array<(payload: string) => void> = [];
    const unlisten = vi.fn(async () => undefined);
    const repository = new RealtimeRepository({
      notify: vi.fn(),
      listen: vi.fn(async (_channel, listener) => {
        notifyListeners.push(listener);

        return { unlisten };
      }),
    });
    const onEvent = vi.fn();
    const subscription = await repository.listenToInternalEvents(onEvent);
    const event = createRealtimeEvent();
    const notifyListener = notifyListeners[0];

    if (!notifyListener) {
      throw new Error("Expected realtime notification listener.");
    }

    notifyListener("{");
    notifyListener(serializeRealtimeInternalEvent(event));
    await subscription.close();

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});

describe("RealtimeService", () => {
  it("fans events out only to sockets registered for the event user", async () => {
    const repository = createFakeRealtimeRepository();
    const service = new RealtimeService(repository);
    const userSocket = createFakeSocket();
    const otherUserSocket = createFakeSocket();

    await service.start();
    service.registerConnection({ userId: "user_1", socket: userSocket });
    service.registerConnection({
      userId: "user_2",
      socket: otherUserSocket,
    });

    repository.emit(createRealtimeEvent());

    expect(userSocket.sentMessages).toEqual([
      JSON.stringify(toRealtimeClientEvent(createRealtimeEvent())),
    ]);
    expect(otherUserSocket.sentMessages).toEqual([]);
  });

  it("cleans up sockets that are closed or fail while sending", async () => {
    const repository = createFakeRealtimeRepository();
    const service = new RealtimeService(repository);
    const closedSocket = createFakeSocket({ readyState: 3 });
    const throwingSocket = createFakeSocket({ shouldThrow: true });
    const openSocket = createFakeSocket();

    await service.start();
    service.registerConnection({ userId: "user_1", socket: closedSocket });
    service.registerConnection({ userId: "user_1", socket: throwingSocket });
    service.registerConnection({ userId: "user_1", socket: openSocket });

    repository.emit(createRealtimeEvent());
    repository.emit(
      createRealtimeEvent({
        jobId: "job_2",
      }),
    );

    expect(closedSocket.sentMessages).toEqual([]);
    expect(throwingSocket.sendAttempts).toBe(1);
    expect(openSocket.sentMessages).toHaveLength(2);
  });
});

function createFakeRealtimeRepository() {
  let listener: ((event: RealtimeInternalEvent) => void) | null = null;

  return {
    listenToInternalEvents: vi.fn(
      async (nextListener: (event: RealtimeInternalEvent) => void) => {
        listener = nextListener;

        return {
          close: vi.fn(async () => undefined),
        };
      },
    ),
    emit(event: RealtimeInternalEvent) {
      listener?.(event);
    },
  } as unknown as RealtimeRepository & {
    emit: (event: RealtimeInternalEvent) => void;
  };
}

function createFakeSocket({
  readyState = 1,
  shouldThrow = false,
}: {
  readyState?: number;
  shouldThrow?: boolean;
} = {}) {
  return {
    readyState,
    sentMessages: [] as string[],
    sendAttempts: 0,
    send(message: string) {
      this.sendAttempts += 1;

      if (shouldThrow) {
        throw new Error("send failed");
      }

      this.sentMessages.push(message);
    },
    close: vi.fn(),
  } satisfies RealtimeSocket & {
    sentMessages: string[];
    sendAttempts: number;
  };
}

function createRealtimeEvent(
  overrides: Partial<{
    jobId: string;
    threadId: string;
    userId: string;
    occurredAt: string;
  }> = {},
) {
  return createGenerationJobSucceededRealtimeInternalEvent({
    jobId: "job_1",
    threadId: "thread_1",
    userId: "user_1",
    occurredAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  });
}
