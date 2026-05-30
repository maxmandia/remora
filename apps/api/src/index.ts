import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import Fastify from 'fastify'

import { appRouter, createTRPCContext } from '@remora/api'
import { parseApiEnv } from '@remora/env'

const env = parseApiEnv(process.env)

const server = Fastify({
  logger: true,
})

server.get('/healthz', async () => ({
  ok: true,
  service: 'api',
}))

await server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext: createTRPCContext,
  },
})

await server.listen({
  host: '0.0.0.0',
  port: env.API_PORT,
})
