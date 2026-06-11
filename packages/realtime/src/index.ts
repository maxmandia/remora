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

export const realtimeClientEventSchemas = {
  "generation.job.succeeded":
    generationJobSucceededRealtimeClientEventSchema,
} as const;

export type RealtimeClientEventType = keyof typeof realtimeClientEventSchemas;

type RealtimeClientEventByType = {
  [Type in RealtimeClientEventType]: z.output<
    (typeof realtimeClientEventSchemas)[Type]
  >;
};

export type GenerationJobSucceededRealtimeClientEvent =
  RealtimeClientEventByType["generation.job.succeeded"];

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
