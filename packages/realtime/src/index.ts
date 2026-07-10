import { z } from "zod";

const generationJobSucceededRealtimeClientEventSchema = z.object({
  id: z
    .string()
    .regex(/^generation\.job\.succeeded:.+$/)
    .transform((value) => value as `generation.job.succeeded:${string}`),
  type: z.literal("generation.job.succeeded"),
  occurredAt: z.string().min(1),
  payload: z.object({
    jobId: z.string().min(1),
    threadId: z.string().min(1),
  }),
});

const creditsBalanceUpdatedRealtimeClientEventSchema = z.object({
  id: z
    .string()
    .regex(/^credits\.balance\.updated:.+$/)
    .transform((value) => value as `credits.balance.updated:${string}`),
  type: z.literal("credits.balance.updated"),
  occurredAt: z.string().min(1),
  payload: z.object({}).strict(),
});

const generationThreadNameUpdatedRealtimeClientEventSchema = z.object({
  id: z
    .string()
    .regex(/^generation\.thread\.name\.updated:.+$/)
    .transform((value) => value as `generation.thread.name.updated:${string}`),
  type: z.literal("generation.thread.name.updated"),
  occurredAt: z.string().min(1),
  payload: z.object({
    threadId: z.string().min(1),
  }),
});

export const realtimeClientEventSchemas = {
  "generation.job.succeeded": generationJobSucceededRealtimeClientEventSchema,
  "credits.balance.updated": creditsBalanceUpdatedRealtimeClientEventSchema,
  "generation.thread.name.updated":
    generationThreadNameUpdatedRealtimeClientEventSchema,
} as const;

export type RealtimeClientEventType = keyof typeof realtimeClientEventSchemas;

type RealtimeClientEventByType = {
  [Type in RealtimeClientEventType]: z.output<
    (typeof realtimeClientEventSchemas)[Type]
  >;
};

export type GenerationJobSucceededRealtimeClientEvent =
  RealtimeClientEventByType["generation.job.succeeded"];
export type CreditsBalanceUpdatedRealtimeClientEvent =
  RealtimeClientEventByType["credits.balance.updated"];
export type GenerationThreadNameUpdatedRealtimeClientEvent =
  RealtimeClientEventByType["generation.thread.name.updated"];

export type RealtimeClientEvent =
  RealtimeClientEventByType[RealtimeClientEventType];

export function createGenerationJobSucceededRealtimeClientEvent({
  jobId,
  threadId,
  occurredAt,
}: {
  jobId: string;
  threadId: string;
  occurredAt: string;
}): GenerationJobSucceededRealtimeClientEvent {
  return {
    id: `generation.job.succeeded:${jobId}`,
    type: "generation.job.succeeded",
    occurredAt,
    payload: {
      jobId,
      threadId,
    },
  };
}

export function createCreditsBalanceUpdatedRealtimeClientEvent({
  eventId,
  occurredAt,
}: {
  eventId: string;
  occurredAt: string;
}): CreditsBalanceUpdatedRealtimeClientEvent {
  return {
    id: `credits.balance.updated:${eventId}`,
    type: "credits.balance.updated",
    occurredAt,
    payload: {},
  };
}

export function createGenerationThreadNameUpdatedRealtimeClientEvent({
  threadId,
  occurredAt,
}: {
  threadId: string;
  occurredAt: string;
}): GenerationThreadNameUpdatedRealtimeClientEvent {
  return {
    id: `generation.thread.name.updated:${threadId}`,
    type: "generation.thread.name.updated",
    occurredAt,
    payload: { threadId },
  };
}

export function parseRealtimeClientEvent(
  value: unknown,
): RealtimeClientEvent | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  const schema =
    realtimeClientEventSchemas[value.type as RealtimeClientEventType];

  if (!schema) {
    return null;
  }

  const result = schema.safeParse(value);

  return result.success ? result.data : null;
}

export function isRealtimeClientEvent(
  value: unknown,
): value is RealtimeClientEvent {
  return parseRealtimeClientEvent(value) !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
