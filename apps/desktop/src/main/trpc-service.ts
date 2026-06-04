import { ipcMain } from 'electron'

import { env } from './env.ts'
import { getStoredSessionCookie } from './auth-service.ts'
import { createDesktopTrpcFetchHandler } from './trpc-fetch-handler.ts'
import {
  trpcChannel,
} from '../shared/trpc.ts'

export function setupTrpcService() {
  const handleTrpcFetch = createDesktopTrpcFetchHandler({
    apiOrigin: env.DESKTOP_API_ORIGIN,
    fetch: globalThis.fetch,
    getSessionCookie: getStoredSessionCookie,
  })

  ipcMain.handle(`${trpcChannel}:fetch`, (_event, request) =>
    handleTrpcFetch(request),
  )
}
