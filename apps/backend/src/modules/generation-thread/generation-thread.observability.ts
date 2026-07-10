import { logObservabilityEvent } from "../observability/observability.service.ts";
import type { LogLevel } from "../observability/observability.types.ts";

export function logGenerationThreadLifecycleEvent(
  event: GenerationThreadLifecycleEvent,
  fields: GenerationThreadLifecycleFields = {},
): void {
  logObservabilityEvent(event, fields, {
    level: getDefaultLogLevel(event),
  });
}

function getDefaultLogLevel(event: GenerationThreadLifecycleEvent): LogLevel {
  if (
    event === "generation_thread.name_generation_failed" ||
    event === "generation_thread.name_workflow_start_failed"
  ) {
    return "warn";
  }

  return "info";
}

export type GenerationThreadLifecycleEvent =
  | "generation_thread.name_workflow_start_failed"
  | "generation_thread.name_generation_started"
  | "generation_thread.name_generated"
  | "generation_thread.name_generation_failed"
  | "generation_thread.name_updated"
  | "generation_thread.name_update_skipped"
  | "generation_thread.name_realtime_published";

export type GenerationThreadLifecycleFields = {
  userId?: string | null;
  requestId?: string | null;
  threadId?: string | null;
  modelId?: string | null;
  temporalWorkflowId?: string | null;
  temporalRunId?: string | null;
  durationMs?: number | null;
  errorSource?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  [key: string]: unknown;
};
