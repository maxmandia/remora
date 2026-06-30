import { createRequire } from "node:module";
import { Worker } from "@temporalio/worker";
import { createTemporalOpenTelemetryPlugin } from "../modules/observability/observability.service.ts";
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
    activities,
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
