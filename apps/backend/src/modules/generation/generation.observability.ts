import { logObservabilityEvent } from "../observability/observability.service.ts";
import type { LogLevel } from "../observability/observability.types.ts";

export function logGenerationLifecycleEvent(
  event: GenerationLifecycleEvent,
  fields: GenerationLifecycleFields = {},
): void {
  logObservabilityEvent(event, fields, {
    level: getDefaultGenerationLogLevel(event, fields),
  });
}

function getDefaultGenerationLogLevel(
  event: GenerationLifecycleEvent,
  fields: GenerationLifecycleFields,
): LogLevel {
  if (
    event === "generation.workflow.start_failed" ||
    event === "generation.provider.task_create_failed" ||
    event === "generation.cost_settlement_failed" ||
    event === "generation.preview_failed" ||
    fields.status === "failed" ||
    fields.status === "final_cost_calculation_failure" ||
    (event === "generation.provider.callback_rejected" &&
      fields.errorCode === "GENERATION_WORKFLOW_SIGNAL_FAILED")
  ) {
    return "error";
  }

  if (
    event === "generation.provider.callback_rejected" ||
    fields.status === "expired" ||
    fields.status === "malformed"
  ) {
    return "warn";
  }

  return "info";
}

export type GenerationLifecycleEvent =
  | "generation.submission.created"
  | "generation.workflow.starting"
  | "generation.workflow.started"
  | "generation.workflow.start_failed"
  | "generation.provider.task_created"
  | "generation.provider.task_create_failed"
  | "generation.provider.callback_received"
  | "generation.provider.callback_rejected"
  | "generation.provider.callback_signaled"
  | "generation.media.stored"
  | "generation.preview.created"
  | "generation.preview_failed"
  | "generation.result.persisted"
  | "generation.cost.settled"
  | "generation.cost_settlement_failed"
  | "generation.job.succeeded"
  | "generation.job.terminal";

export type GenerationLifecycleFields = {
  userId?: string | null;
  requestId?: string | null;
  submissionId?: string | null;
  jobId?: string | null;
  threadId?: string | null;
  modelId?: string | null;
  modelSpecId?: string | null;
  providerId?: string | null;
  providerTaskId?: string | null;
  providerModelId?: string | null;
  temporalWorkflowId?: string | null;
  temporalRunId?: string | null;
  status?: string | null;
  durationMs?: number | null;
  errorSource?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  [key: string]: unknown;
};
