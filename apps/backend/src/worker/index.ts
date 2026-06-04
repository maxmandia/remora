import Fastify from 'fastify'

import { parseBackendWorkerEnv } from '@remora/env'

import { createTemporalWorker } from '../temporal/worker.ts'

const env = parseBackendWorkerEnv(process.env)

const server = Fastify({
  logger: true,
})

server.get('/healthz', async () => ({
  ok: true,
  service: 'backend-worker',
}))

await server.listen({
  host: '0.0.0.0',
  port: env.WORKER_HEALTH_PORT,
})

const temporalWorker = await createTemporalWorker({
  address: env.TEMPORAL_ADDRESS,
  namespace: env.TEMPORAL_NAMESPACE,
  taskQueue: env.TEMPORAL_TASK_QUEUE,
})

try {
  await temporalWorker.run()
} finally {
  await server.close()
}
