import * as SentryMain from "@sentry/electron/main";

import { env } from "./env.ts";

const errorMessageMaxLength = 500;
const urlPattern = /\b(?:https?:\/\/|s3:\/\/|r2:\/\/)[^\s"')]+/gi;
const filePathPattern = /\b(?:\/[\w .@-]+){2,}/g;
const sensitiveKeyPattern =
  /(authorization|cookie|file.?path|password|payload|prompt|raw|secret|token|url|api.?key)/i;

type ObservabilityFields = Record<string, unknown>;
type SentryInitOptions = Parameters<typeof SentryMain.init>[0];
type SentryErrorEvent = Parameters<
  NonNullable<SentryInitOptions["beforeSend"]>
>[0];

let sentry: typeof SentryMain | null = null;

export function initializeDesktopObservability(): void {
  if (!env.DESKTOP_SENTRY_DSN) {
    return;
  }

  getSentry().init({
    dsn: env.DESKTOP_SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    release: env.SENTRY_RELEASE ?? undefined,
    sendDefaultPii: true,
    beforeSend: (event) => sanitizeSentryEvent(event),
  });
}

export function captureDesktopException(
  error: unknown,
  fields: ObservabilityFields = {},
): void {
  const sentry = getSentry();

  if (!sentry.isInitialized()) {
    return;
  }

  const sanitizedFields = sanitizeObservabilityFields(fields);

  sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(sanitizedFields)) {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        scope.setTag(key, String(value));
      }
    }

    scope.setContext("remora", sanitizedFields);
    sentry.captureException(error);
  });
}

export function wrapIpcHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (...args: TArgs) => TResult | Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await handler(...args);
    } catch (error) {
      captureDesktopException(error, { ipcChannel: channel });

      throw error;
    }
  };
}

export function setDesktopObservabilityUser(userId: string | null): void {
  const sentry = getSentry();

  if (!sentry.isInitialized()) {
    return;
  }

  sentry.setUser(userId ? { id: userId } : null);
}

export function addDesktopBackendRequestBreadcrumb({
  url,
  method,
  status,
  requestId,
  traceId,
  spanId,
}: {
  url: string;
  method: string;
  status: number;
  requestId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
}): void {
  const sentry = getSentry();

  if (!sentry.isInitialized()) {
    return;
  }

  sentry.addBreadcrumb({
    category: "backend.request",
    level: "error",
    message: `${method.toUpperCase()} ${getSafePath(url)} failed`,
    data: {
      method: method.toUpperCase(),
      status,
      requestId,
      traceId,
      spanId,
    },
  });
}

export function sanitizeObservabilityFieldsForTest(
  fields: ObservabilityFields,
): ObservabilityFields {
  return sanitizeObservabilityFields(fields);
}

export function setDesktopSentryForTest(nextSentry: typeof SentryMain): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }

  sentry = nextSentry;
}

function sanitizeObservabilityFields(
  fields: ObservabilityFields,
): ObservabilityFields {
  const sanitized: ObservabilityFields = {};

  for (const [key, value] of Object.entries(fields)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    const sanitizedValue = sanitizeObservabilityValue(value);

    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }

  return sanitized;
}

function sanitizeObservabilityValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeMessage(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeObservabilityValue(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const sanitized: ObservabilityFields = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        continue;
      }

      const sanitizedValue = sanitizeObservabilityValue(nestedValue);

      if (sanitizedValue !== undefined) {
        sanitized[key] = sanitizedValue;
      }
    }

    return sanitized;
  }

  return undefined;
}

function sanitizeMessage(message: string): string {
  const sanitizedMessage = message
    .replace(urlPattern, "[redacted-url]")
    .replace(filePathPattern, "[redacted-path]");

  if (sanitizedMessage.length <= errorMessageMaxLength) {
    return sanitizedMessage;
  }

  return `${sanitizedMessage.slice(0, errorMessageMaxLength)}...`;
}

function isSensitiveKey(key: string): boolean {
  return sensitiveKeyPattern.test(key);
}

function getSafePath(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    return url.pathname;
  } catch {
    return rawUrl.split("?")[0] ?? rawUrl;
  }
}

function getSentry(): typeof SentryMain {
  sentry ??= SentryMain;

  return sentry;
}

function sanitizeSentryEvent(event: SentryErrorEvent): SentryErrorEvent {
  if (event.message) {
    event.message = sanitizeMessage(event.message);
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) => ({
      ...value,
      value:
        typeof value.value === "string"
          ? sanitizeMessage(value.value)
          : value.value,
    }));
  }

  event.tags = sanitizeSentryRecord(event.tags) as Record<string, string>;
  event.extra = sanitizeSentryRecord(event.extra);
  event.contexts = sanitizeSentryRecord(
    event.contexts,
  ) as typeof event.contexts;

  return event;
}

function sanitizeSentryRecord(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeObservabilityValue(value);

  return isRecord(sanitized) ? sanitized : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
