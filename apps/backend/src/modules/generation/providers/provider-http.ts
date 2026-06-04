type Fetch = typeof fetch

export type ProviderErrorDetails = {
  statusCode: number | null
  code: string | null
  providerMessage: string | null
}

export type ProviderJsonRequest = {
  providerName: string
  baseUrl: string
  path: string
  fetcher?: Fetch
  init: RequestInit
}

export class ProviderHttpError extends Error {
  readonly statusCode: number | null
  readonly code: string | null
  readonly providerMessage: string | null

  constructor(providerName: string, message: string, details: ProviderErrorDetails) {
    super(`${providerName} ${message}`)
    this.name = 'ProviderHttpError'
    this.statusCode = details.statusCode
    this.code = details.code
    this.providerMessage = details.providerMessage
  }
}

export async function requestProviderJson({
  providerName,
  baseUrl,
  path,
  fetcher = fetch,
  init,
}: ProviderJsonRequest): Promise<unknown> {
  const response = await fetcher(createProviderUrl(baseUrl, path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const body = await response.text()
  const parsedBody = parseJsonBody(providerName, body)

  if (!response.ok) {
    const providerError = extractProviderError(parsedBody)

    throw new ProviderHttpError(providerName, 'request failed', {
      statusCode: response.status,
      code: providerError.code,
      providerMessage: providerError.message,
    })
  }

  return parsedBody
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonBody(providerName: string, body: string): unknown {
  if (!body) {
    return null
  }

  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new ProviderHttpError(providerName, 'response was not valid JSON', {
      statusCode: null,
      code: null,
      providerMessage: null,
    })
  }
}

function extractProviderError(value: unknown) {
  if (isJsonObject(value)) {
    if (isJsonObject(value.error)) {
      return {
        code: typeof value.error.code === 'string' ? value.error.code : null,
        message: typeof value.error.message === 'string' ? value.error.message : null,
      }
    }

    return {
      code: typeof value.code === 'string' ? value.code : null,
      message: typeof value.message === 'string' ? value.message : null,
    }
  }

  return {
    code: null,
    message: null,
  }
}

function createProviderUrl(baseUrl: string, path: string) {
  return new URL(path.replace(/^\/+/, ''), normalizeBaseUrl(baseUrl))
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}
