import Fastify from 'fastify'

import { parseBackendWorkerEnv } from '@remora/env'

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
