import { ipcMain } from "electron";

import { env } from "./env.ts";
import { wrapIpcHandler } from "./observability.ts";
import { getStoredSessionCookie } from "./auth-service.ts";
import { createDesktopTrpcFetchHandler } from "./trpc-fetch-handler.ts";
import { trpcChannel } from "../shared/trpc.ts";

export function setupTrpcService() {
  const handleTrpcFetch = createDesktopTrpcFetchHandler({
    apiOrigin: env.DESKTOP_API_ORIGIN,
    fetch: globalThis.fetch,
    getSessionCookie: getStoredSessionCookie,
  });

  const channel = `${trpcChannel}:fetch`;

  ipcMain.handle(
    channel,
    wrapIpcHandler(channel, (_event, request) => handleTrpcFetch(request)),
  );
}
