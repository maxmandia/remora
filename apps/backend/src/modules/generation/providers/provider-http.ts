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
    super(formatProviderHttpErrorMessage(providerName, message, details));
    this.name = "ProviderHttpError";
    this.statusCode = details.statusCode;
    this.code = details.code;
    this.providerMessage = details.providerMessage;
    this.requestId = details.requestId ?? null;
  }
}

function formatProviderHttpErrorMessage(
  providerName: string,
  message: string,
  details: ProviderErrorDetails,
) {
  const providerMessage = details.providerMessage?.trim();
  const context = [
    details.statusCode === null ? null : `HTTP ${details.statusCode}`,
    details.code ? `code ${details.code}` : null,
    details.requestId ? `request ${details.requestId}` : null,
  ].filter((value): value is string => value !== null);

  return [
    `${providerName} ${message}`,
    providerMessage ? `: ${providerMessage}` : "",
    context.length > 0 ? ` (${context.join(", ")})` : "",
  ].join("");
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
      message:
        typeof value.message === "string"
          ? value.message
          : formatValidationDetails(value.detail),
      requestId,
    };
  }

  return {
    code: null,
    message: null,
    requestId: null,
  };
}

function formatValidationDetails(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    return null;
  }

  const details = value.flatMap((detail) => {
    if (!isJsonObject(detail) || typeof detail.msg !== "string") {
      return [];
    }

    const message = detail.msg.trim();
    if (!message) {
      return [];
    }

    const location = formatValidationLocation(detail.loc);
    return [location ? `${location}: ${message}` : message];
  });

  return details.length > 0 ? details.join("; ") : null;
}

function formatValidationLocation(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const segments = value.filter(
    (segment): segment is string | number =>
      typeof segment === "string" ||
      (typeof segment === "number" && Number.isInteger(segment)),
  );

  if (segments.length === 0) {
    return null;
  }

  return segments
    .map((segment, index) =>
      typeof segment === "number"
        ? `[${segment}]`
        : index === 0
          ? segment
          : `.${segment}`,
    )
    .join("");
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
