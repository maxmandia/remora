import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import cors from '@fastify/cors'
import Fastify from 'fastify'

import { appRouter, createTRPCContext } from '@remora/api'
import { auth } from '@remora/auth'
import { parseApiEnv } from '@remora/env'

const env = parseApiEnv(process.env)

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
  service: 'api',
}))

server.route({
  method: ['GET', 'POST'],
  url: '/api/auth/*',
  async handler(request, reply) {
    try {
      const protocolHeader = request.headers['x-forwarded-proto']
      const protocol = Array.isArray(protocolHeader)
        ? protocolHeader[0]
        : protocolHeader
          ? protocolHeader.split(',')[0]
          : 'http'
      const host = request.headers.host ?? `localhost:${env.API_PORT}`
      const url = new URL(request.url, `${protocol}://${host}`)
      const headers = new Headers()

      for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            headers.append(key, item)
          }
        } else if (value !== undefined) {
          headers.set(key, value)
        }
      }

      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          ...(request.body === undefined
            ? {}
            : { body: JSON.stringify(request.body) }),
        }),
      )

      reply.status(response.status)
      response.headers.forEach((value, key) => reply.header(key, value))

      return reply.send(response.body ? await response.text() : null)
    } catch (error) {
      request.log.error({ error }, 'Authentication error')

      return reply.status(500).send({
        error: 'Internal authentication error',
        code: 'AUTH_FAILURE',
      })
    }
  },
})

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
