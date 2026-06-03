import type { FastifyReply, FastifyRequest } from 'fastify'

import { auth } from './auth.ts'

export async function handleAuthRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  apiPort: number,
) {
  try {
    const url = createAuthRequestUrl(request, apiPort)
    const headers = createAuthRequestHeaders(request)
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
}

function createAuthRequestUrl(request: FastifyRequest, apiPort: number) {
  const protocolHeader = request.headers['x-forwarded-proto']
  const protocol = Array.isArray(protocolHeader)
    ? protocolHeader[0]
    : protocolHeader
      ? protocolHeader.split(',')[0]
      : 'http'
  const host = request.headers.host ?? `localhost:${apiPort}`

  return new URL(request.url, `${protocol}://${host}`)
}

function createAuthRequestHeaders(request: FastifyRequest) {
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

  return headers
}
