import { describe, expect, it } from "vitest";

import {
  createCreditsBalanceUpdatedRealtimeClientEvent,
  createGenerationJobSucceededRealtimeClientEvent,
  createGenerationThreadNameUpdatedRealtimeClientEvent,
  isRealtimeClientEvent,
  parseRealtimeClientEvent,
} from "./index.ts";

describe("realtime client event protocol", () => {
  it("accepts generation success events", () => {
    const event = createGenerationJobSucceededRealtimeClientEvent({
      jobId: "job_1",
      threadId: "thread_1",
      occurredAt: "2026-06-05T00:00:00.000Z",
    });

    expect(parseRealtimeClientEvent(event)).toEqual(event);
    expect(isRealtimeClientEvent(event)).toBe(true);
  });

  it("accepts credit balance update events", () => {
    const event = createCreditsBalanceUpdatedRealtimeClientEvent({
      eventId: "event_1",
      occurredAt: "2026-06-05T00:00:00.000Z",
    });

    expect(parseRealtimeClientEvent(event)).toEqual(event);
    expect(isRealtimeClientEvent(event)).toBe(true);
  });

  it("accepts generation thread name update events", () => {
    const event = createGenerationThreadNameUpdatedRealtimeClientEvent({
      threadId: "thread_1",
      occurredAt: "2026-06-05T00:00:00.000Z",
    });

    expect(parseRealtimeClientEvent(event)).toEqual(event);
    expect(isRealtimeClientEvent(event)).toBe(true);
  });

  it("rejects unknown event types", () => {
    expect(
      parseRealtimeClientEvent({
        id: "billing.profile.updated:user_1",
        type: "billing.profile.updated",
        occurredAt: "2026-06-05T00:00:00.000Z",
        payload: {
          balance: 100,
        },
      }),
    ).toBeNull();
    expect(
      parseRealtimeClientEvent({
        id: "generation.thread.name.updated:thread_1",
        type: "generation.thread.name.updated",
        occurredAt: "2026-06-05T00:00:00.000Z",
        payload: { threadId: "" },
      }),
    ).toBeNull();
  });

  it("rejects malformed payloads", () => {
    expect(
      parseRealtimeClientEvent({
        id: "generation.job.succeeded:job_1",
        type: "generation.job.succeeded",
        occurredAt: "2026-06-05T00:00:00.000Z",
        payload: {
          jobId: "",
          threadId: "thread_1",
        },
      }),
    ).toBeNull();
    expect(
      parseRealtimeClientEvent({
        id: "credits.balance.updated:event_1",
        type: "credits.balance.updated",
        occurredAt: "2026-06-05T00:00:00.000Z",
        payload: {
          balance: 100,
        },
      }),
    ).toBeNull();
    expect(parseRealtimeClientEvent("{")).toBeNull();
  });
});
