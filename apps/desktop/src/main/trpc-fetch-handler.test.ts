import { describe, expect, it, vi } from 'vitest'

import type { DesktopTrpcFetchRequest } from '../shared/trpc.ts'
import { createDesktopTrpcFetchHandler } from './trpc-fetch-handler.ts'

const baseRequest: DesktopTrpcFetchRequest = {
  url: '/trpc/model.listPublished?batch=1',
  method: 'GET',
  headers: {
    accept: 'application/json',
    cookie: 'renderer-cookie=ignored',
  },
  body: null,
}

describe('createDesktopTrpcFetchHandler', () => {
  it('forwards valid tRPC requests with the stored session cookie', async () => {
    const fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[] = []
    const fetchMock: typeof globalThis.fetch = async (input, init) => {
      fetchCalls.push({ input, init })

      return new Response('{"result":{"data":[]}}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    }
    const handler = createDesktopTrpcFetchHandler({
      apiOrigin: 'http://localhost:4000',
      fetch: fetchMock,
      getSessionCookie: async () => 'better-auth.session_token=signed-token',
    })

    const response = await handler(baseRequest)
    const fetchCall = fetchCalls[0]
    const headers = fetchCall?.init?.headers as Headers

    expect(fetchCall?.input.toString()).toBe(
      'http://localhost:4000/trpc/model.listPublished?batch=1',
    )
    expect(fetchCall?.init?.method).toBe('GET')
    expect(headers.get('accept')).toBe('application/json')
    expect(headers.get('cookie')).toBe('better-auth.session_token=signed-token')
    expect(response.status).toBe(200)
    expect(response.headers).toContainEqual(['content-type', 'application/json'])
    expect(response.body).toBe('{"result":{"data":[]}}')
  })

  it('rejects non-tRPC URLs', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>()
    const handler = createDesktopTrpcFetchHandler({
      apiOrigin: 'http://localhost:4000',
      fetch: fetchMock,
      getSessionCookie: async () => null,
    })

    await expect(
      handler({
        ...baseRequest,
        url: 'http://localhost:4000/healthz',
      }),
    ).rejects.toThrow('Unsupported tRPC request URL.')
    await expect(
      handler({
        ...baseRequest,
        url: 'http://localhost:4001/trpc/model.listPublished',
      }),
    ).rejects.toThrow('Unsupported tRPC request URL.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects unsupported request methods', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>()
    const handler = createDesktopTrpcFetchHandler({
      apiOrigin: 'http://localhost:4000',
      fetch: fetchMock,
      getSessionCookie: async () => null,
    })

    await expect(
      handler({
        ...baseRequest,
        method: 'PUT',
      }),
    ).rejects.toThrow('Unsupported tRPC request method.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
