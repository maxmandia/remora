import Fastify from "fastify";

import { parseBackendWorkerEnv } from "@remora/env";

import {
  initializeObservability,
  shutdownObservability,
} from "../modules/observability/observability.service.ts";
import { createTemporalWorker } from "../temporal/worker.ts";

const env = parseBackendWorkerEnv(process.env);
const observability = initializeObservability({
  serviceName: "worker-backend",
});

const server = Fastify({
  loggerInstance: observability.logger,
});

server.get("/healthz", async () => ({
  ok: true,
  service: "backend-worker",
}));

try {
  await server.listen({
    host: "0.0.0.0",
    port: env.WORKER_HEALTH_PORT,
  });

  const temporalWorker = await createTemporalWorker({
    address: env.TEMPORAL_ADDRESS,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
  });

  await temporalWorker.run();
} finally {
  await server.close();
  await shutdownObservability();
}
