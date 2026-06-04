import { proxyActivities } from "@temporalio/workflow";

import {
  temporalSkeletonWorkflowType,
  type TemporalSkeletonWorkflowInput,
  type TemporalSkeletonWorkflowResult,
} from "./types.ts";

import type * as activities from "./activities.ts";

const { temporalSkeletonActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: {
    maximumAttempts: 3,
  },
});

export async function temporalSkeletonWorkflow(
  input: TemporalSkeletonWorkflowInput = {},
): Promise<TemporalSkeletonWorkflowResult> {
  const activity = await temporalSkeletonActivity();

  return {
    ok: true,
    workflow: temporalSkeletonWorkflowType,
    activity,
    note: input.note ?? null,
  };
}
