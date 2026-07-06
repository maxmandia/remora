import { createRequire } from "node:module";
import { Worker } from "@temporalio/worker";
import {
  captureObservabilityException,
  createTemporalOpenTelemetryPlugin,
} from "../modules/observability/observability.service.ts";
import * as activities from "./activities.ts";
import { connectTemporalWithRetry } from "./connection.ts";
import type { TemporalWorkerConfig, TemporalWorkerRuntime } from "./types.ts";

const require = createRequire(import.meta.url);

export async function createTemporalWorker({
  address,
  namespace,
  taskQueue,
}: TemporalWorkerConfig): Promise<TemporalWorkerRuntime> {
  const connection = await connectTemporalWithRetry({ address });
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: require.resolve("./workflows.ts"),
    activities: wrapActivities(activities),
    plugins: [createTemporalOpenTelemetryPlugin()],
    shutdownGraceTime: "10 seconds",
  });

  return {
    run: async () => {
      try {
        await worker.run();
      } finally {
        await connection.close();
      }
    },
  };
}

function wrapActivities<T extends Record<string, unknown>>(activityMap: T): T {
  return Object.fromEntries(
    Object.entries(activityMap).map(([name, activity]) => [
      name,
      typeof activity === "function"
        ? wrapActivity(name, activity as (...args: unknown[]) => unknown)
        : activity,
    ]),
  ) as T;
}

function wrapActivity(name: string, activity: (...args: unknown[]) => unknown) {
  return async (...args: unknown[]) => {
    try {
      return await activity(...args);
    } catch (error) {
      captureObservabilityException(error, {
        activity: name,
        input: args[0],
      });

      throw error;
    }
  };
}
