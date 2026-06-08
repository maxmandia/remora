import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import cors from '@fastify/cors'
import Fastify from 'fastify'

import { parseBackendHttpEnv } from '@remora/env'

import { handleAuthRequest } from '../modules/auth/auth.http.ts'
import { registerGenerationCallbackRoutes } from '../modules/generation/generation.router.ts'
import { appRouter, createTRPCContext } from '../trpc/index.ts'

const env = parseBackendHttpEnv(process.env)

const server = Fastify({
  logger: true,
})

await server.register(cors, {
  origin(origin, callback) {
    callback(null, !origin || env.API_CORS_ORIGINS.includes(origin))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
})

server.get('/healthz', async () => ({
  ok: true,
  service: 'backend-http',
}))

server.route({
  method: ['GET', 'POST'],
  url: '/api/auth/*',
  handler: (request, reply) => handleAuthRequest(request, reply, env.API_PORT),
})

await registerGenerationCallbackRoutes(server)

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
