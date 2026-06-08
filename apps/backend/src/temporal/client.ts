import { Client, Connection } from "@temporalio/client";

import { parseBackendWorkerEnv } from "@remora/env";

import { createSeedanceVideoGenerationWorkflow } from "./workflows.ts";

import {
  seedanceVideoGenerationProviderCallbackSignal,
  type CreateSeedanceVideoGenerationWorkflowInput,
  type SeedanceVideoGenerationProviderCallback,
} from "./types.ts";

export type StartedGenerationWorkflow = {
  workflowId: string;
  runId: string;
};

// TODO: Can probably make this more generic so we don't repeat this pattern for each generation workflow
export async function startSeedanceVideoGenerationWorkflow(
  input: CreateSeedanceVideoGenerationWorkflowInput,
): Promise<StartedGenerationWorkflow> {
  const env = parseBackendWorkerEnv(process.env);
  const connection = await Connection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  try {
    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });
    const workflowId = `generation-job:${input.jobId}`;
    const handle = await client.workflow.start(
      createSeedanceVideoGenerationWorkflow,
      {
        workflowId,
        taskQueue: env.TEMPORAL_TASK_QUEUE,
        args: [input],
      },
    );

    return {
      workflowId,
      runId: handle.firstExecutionRunId,
    };
  } finally {
    await connection.close();
  }
}

export async function signalSeedanceVideoGenerationProviderCallback({
  jobId,
  callback,
}: {
  jobId: string;
  callback: SeedanceVideoGenerationProviderCallback;
}) {
  const env = parseBackendWorkerEnv(process.env);
  const connection = await Connection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  try {
    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });
    const handle = client.workflow.getHandle(`generation-job:${jobId}`);

    await handle.signal(seedanceVideoGenerationProviderCallbackSignal, callback);
  } finally {
    await connection.close();
  }
}
