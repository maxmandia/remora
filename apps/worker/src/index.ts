import Fastify from 'fastify'

import { parseWorkerEnv } from '@remora/env'

const env = parseWorkerEnv(process.env)

const server = Fastify({
  logger: true,
})

server.get('/healthz', async () => ({
  ok: true,
  service: 'worker',
}))

await server.listen({
  host: '0.0.0.0',
  port: env.WORKER_HEALTH_PORT,
})
