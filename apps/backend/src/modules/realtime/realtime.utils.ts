import {
  createGenerationJobSucceededRealtimeClientEvent,
  parseRealtimeClientEvent,
} from "@remora/realtime";

import type {
  RealtimeClientEvent,
  RealtimeInternalEvent,
} from "./realtime.types.ts";

export function createGenerationJobSucceededRealtimeInternalEvent({
  jobId,
  threadId,
  userId,
  occurredAt,
}: {
  jobId: string;
  threadId: string;
  userId: string;
  occurredAt: string;
}): RealtimeInternalEvent {
  return {
    ...createGenerationJobSucceededRealtimeClientEvent({
      jobId,
      threadId,
      occurredAt,
    }),
    userId,
  };
}

export function serializeRealtimeInternalEvent(event: RealtimeInternalEvent) {
  return JSON.stringify(event);
}

export function parseRealtimeInternalEvent(
  payload: string,
): RealtimeInternalEvent | null {
  try {
    const parsed = JSON.parse(payload);

    if (
      !isRecord(parsed) ||
      typeof parsed.userId !== "string" ||
      parsed.userId.length === 0
    ) {
      return null;
    }

    const event = parseRealtimeClientEvent(parsed);

    if (!event) {
      return null;
    }

    return {
      ...event,
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

export function toRealtimeClientEvent({
  userId: _userId,
  ...event
}: RealtimeInternalEvent): RealtimeClientEvent {
  return event;
}

export function serializeRealtimeClientEvent(event: RealtimeClientEvent) {
  return JSON.stringify(event);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
