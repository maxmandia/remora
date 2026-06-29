import {
  Client,
  Connection,
  WorkflowExecutionAlreadyStartedError,
} from "@temporalio/client";

import { parseBackendWorkerEnv } from "@remora/env";

import {
  createCreditAutoTopUpWorkflow,
  createManualCreditPurchaseWorkflow,
  createSeedanceVideoGenerationWorkflow,
} from "./workflows.ts";

import {
  seedanceVideoGenerationProviderCallbackSignal,
  type CreateCreditAutoTopUpWorkflowInput,
  type CreateManualCreditPurchaseWorkflowInput,
  type CreateSeedanceVideoGenerationWorkflowInput,
  type SeedanceVideoGenerationProviderCallback,
} from "./types.ts";

export type StartedGenerationWorkflow = {
  workflowId: string;
  runId: string;
};

export type StartedManualCreditPurchaseWorkflow = {
  workflowId: string;
  runId: string | null;
  alreadyStarted: boolean;
};

export type StartedCreditAutoTopUpWorkflow = {
  workflowId: string;
  runId: string | null;
  alreadyStarted: boolean;
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

export async function startManualCreditPurchaseWorkflow(
  input: CreateManualCreditPurchaseWorkflowInput,
): Promise<StartedManualCreditPurchaseWorkflow> {
  const env = parseBackendWorkerEnv(process.env);
  const connection = await Connection.connect({
    address: env.TEMPORAL_ADDRESS,
  });
  const workflowId = `credit-purchase:checkout-session:${input.stripeCheckoutSessionId}`;

  try {
    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });
    const handle = await client.workflow.start(
      createManualCreditPurchaseWorkflow,
      {
        workflowId,
        workflowIdReusePolicy: "REJECT_DUPLICATE",
        taskQueue: env.TEMPORAL_TASK_QUEUE,
        args: [input],
      },
    );

    return {
      workflowId,
      runId: handle.firstExecutionRunId,
      alreadyStarted: false,
    };
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      return {
        workflowId,
        runId: null,
        alreadyStarted: true,
      };
    }

    throw error;
  } finally {
    await connection.close();
  }
}

export async function startCreditAutoTopUpWorkflow(
  input: CreateCreditAutoTopUpWorkflowInput,
): Promise<StartedCreditAutoTopUpWorkflow> {
  const env = parseBackendWorkerEnv(process.env);
  const connection = await Connection.connect({
    address: env.TEMPORAL_ADDRESS,
  });
  const workflowId = `credit-auto-top-up:trigger-ledger-entry:${input.triggerLedgerEntryId}`;

  try {
    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });
    const handle = await client.workflow.start(createCreditAutoTopUpWorkflow, {
      workflowId,
      workflowIdReusePolicy: "REJECT_DUPLICATE",
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      args: [input],
    });

    return {
      workflowId,
      runId: handle.firstExecutionRunId,
      alreadyStarted: false,
    };
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      return {
        workflowId,
        runId: null,
        alreadyStarted: true,
      };
    }

    throw error;
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

    await handle.signal(
      seedanceVideoGenerationProviderCallbackSignal,
      callback,
    );
  } finally {
    await connection.close();
  }
}
