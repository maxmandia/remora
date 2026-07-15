type Fetch = typeof fetch;

export type ProviderErrorDetails = {
  statusCode: number | null;
  code: string | null;
  providerMessage: string | null;
  requestId?: string | null;
};

export type ProviderJsonRequest = {
  providerName: string;
  baseUrl: string;
  path: string;
  fetcher?: Fetch;
  init: RequestInit;
};

export class ProviderHttpError extends Error {
  readonly statusCode: number | null;
  readonly code: string | null;
  readonly providerMessage: string | null;
  readonly requestId: string | null;

  constructor(
    providerName: string,
    message: string,
    details: ProviderErrorDetails,
  ) {
    super(`${providerName} ${message}`);
    this.name = "ProviderHttpError";
    this.statusCode = details.statusCode;
    this.code = details.code;
    this.providerMessage = details.providerMessage;
    this.requestId = details.requestId ?? null;
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
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.text();
  const parsedBody = parseJsonBody(providerName, body);

  if (!response.ok) {
    const providerError = extractProviderError(parsedBody);

    throw new ProviderHttpError(providerName, "request failed", {
      statusCode: response.status,
      code: providerError.code,
      providerMessage: providerError.message,
      requestId: providerError.requestId,
    });
  }

  return parsedBody;
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJsonBody(providerName: string, body: string): unknown {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ProviderHttpError(providerName, "response was not valid JSON", {
      statusCode: null,
      code: null,
      providerMessage: null,
    });
  }
}

function extractProviderError(value: unknown) {
  if (isJsonObject(value)) {
    const requestId =
      typeof value.request_id === "string" ? value.request_id : null;

    if (isJsonObject(value.error)) {
      return {
        code: normalizeProviderErrorCode(value.error.code),
        message:
          typeof value.error.message === "string" ? value.error.message : null,
        requestId:
          typeof value.error.request_id === "string"
            ? value.error.request_id
            : requestId,
      };
    }

    return {
      code: normalizeProviderErrorCode(value.code),
      message: typeof value.message === "string" ? value.message : null,
      requestId,
    };
  }

  return {
    code: null,
    message: null,
    requestId: null,
  };
}

function normalizeProviderErrorCode(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : null;
}

function createProviderUrl(baseUrl: string, path: string) {
  return new URL(path.replace(/^\/+/, ""), normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
