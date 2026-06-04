export const trpcChannel = 'remora-trpc'

export type DesktopTrpcFetchRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
}

export type DesktopTrpcFetchResponse = {
  status: number
  statusText: string
  headers: [string, string][]
  body: string
}

export type DesktopTrpcBridge = {
  fetch: (
    request: DesktopTrpcFetchRequest,
  ) => Promise<DesktopTrpcFetchResponse>
}
