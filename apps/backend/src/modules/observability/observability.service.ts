import type {
  Attributes,
  Context,
  Link,
  Span,
  SpanKind,
} from "@opentelemetry/api";
import { isSpanContextValid, SpanStatusCode, trace } from "@opentelemetry/api";
import {
  CompositePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import type { Span as SdkSpan } from "@opentelemetry/sdk-trace-base";
import {
  BatchSpanProcessor,
  SamplingDecision,
  type ReadableSpan,
  type Sampler,
  type SamplingResult,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import * as Sentry from "@sentry/node";
import { SentryPropagator, wrapSamplingDecision } from "@sentry/opentelemetry";
import { OpenTelemetryPlugin } from "@temporalio/interceptors-opentelemetry";
import { createRequire } from "node:module";
import type { Logger, LoggerOptions } from "pino";

import { parseBackendObservabilityEnv } from "@remora/env";

import type {
  LogLevel,
  ObservabilityFields,
  ObservabilityInitOptions,
  ObservabilityRuntime,
} from "./observability.types.ts";

const require = createRequire(import.meta.url);
const pino = require("pino") as typeof import("pino");

const defaultServiceName = "remora-backend";
const errorMessageMaxLength = 500;
const urlPattern = /\b(?:https?:\/\/|s3:\/\/|r2:\/\/)[^\s"')]+/gi;
const filePathPattern = /\b(?:\/[\w .@-]+){2,}/g;
const sensitiveKeyPattern =
  /(authorization|cookie|file.?path|password|payload|prompt|raw|secret|token|url|api.?key)/i;
const expectedErrorNames = new Set([
  "CreditAutoTopUpSettingsNotEditableError",
  "GenerationAttachmentMediaValidationError",
  "GenerationInputValidationError",
  "GenerationProjectNotFoundError",
  "GenerationThreadNotFoundError",
  "InsufficientCreditBalanceError",
  "ManualCreditPurchaseVerificationError",
  "ProviderHttpError",
  "TRPCError",
  "UnsupportedGenerationModelError",
  "ZodError",
]);
const expectedTRPCCodes = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "UNAUTHORIZED",
]);

let runtime: ObservabilityRuntime | null = null;
let tracerProvider: NodeTracerProvider | null = null;
let spanProcessor: SpanProcessor | null = null;
let resource: Resource | null = null;
let sentryClient: Sentry.NodeClient | undefined;

class NoopSpanProcessor implements SpanProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(_span: SdkSpan, _parentContext: Context): void {}

  onEnd(_span: ReadableSpan): void {}

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

class TracePreservingSentrySampler implements Sampler {
  shouldSample(
    context: Context,
    _traceId: string,
    _spanName: string,
    _spanKind: SpanKind,
    attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    return wrapSamplingDecision({
      context,
      decision: SamplingDecision.RECORD_AND_SAMPLED,
      spanAttributes: attributes,
    });
  }

  toString(): string {
    return "TracePreservingSentrySampler";
  }
}

export function initializeObservability({
  serviceName,
}: ObservabilityInitOptions): ObservabilityRuntime {
  if (runtime) {
    return runtime;
  }

  const sentryConfig = parseBackendObservabilityEnv(process.env);

  sentryClient = initializeSentry({
    dsn: sentryConfig.SENTRY_DSN,
    environment: sentryConfig.SENTRY_ENVIRONMENT,
    release: sentryConfig.SENTRY_RELEASE,
  });
  resource = createResource(serviceName);
  spanProcessor = createSpanProcessor();
  tracerProvider = new NodeTracerProvider({
    resource,
    ...(sentryClient ? { sampler: new TracePreservingSentrySampler() } : {}),
    spanLimits: {
      attributeValueLengthLimit: 1_000,
      attributeCountLimit: 64,
      eventCountLimit: 128,
      attributePerEventCountLimit: 64,
    },
  });

  if (!(spanProcessor instanceof NoopSpanProcessor)) {
    tracerProvider.addSpanProcessor(spanProcessor);
  }

  tracerProvider.register(
    sentryClient
      ? {
          contextManager: new Sentry.SentryContextManager(),
          propagator: new CompositePropagator({
            propagators: [
              new W3CTraceContextPropagator(),
              new SentryPropagator(),
            ],
          }),
        }
      : undefined,
  );

  runtime = {
    logger: createLogger(serviceName),
    sentryEnabled: Boolean(sentryClient),
    serviceName,
  };

  return runtime;
}

function getObservabilityRuntime(): ObservabilityRuntime {
  return (
    runtime ??
    initializeObservability({
      serviceName: defaultServiceName,
    })
  );
}

export function createTemporalOpenTelemetryPlugin(): OpenTelemetryPlugin {
  getObservabilityRuntime();

  return new OpenTelemetryPlugin({
    resource: getResource(),
    spanProcessor: getSpanProcessor(),
    tracer: getTracer(),
  });
}

export async function shutdownObservability(): Promise<void> {
  const provider = tracerProvider;

  tracerProvider = null;
  spanProcessor = null;
  resource = null;
  runtime = null;
  sentryClient = undefined;

  await Sentry.flush(2_000);
  await provider?.shutdown();
}

export function logObservabilityEvent(
  event: string,
  fields: ObservabilityFields = {},
  options: { level?: LogLevel } = {},
): void {
  const sanitizedFields = sanitizeLogFields(fields);
  const level = options.level ?? "info";
  const span = trace.getActiveSpan();

  span?.addEvent(event, toSpanAttributes(sanitizedFields));
  getObservabilityRuntime().logger[level](sanitizedFields, event);
}

export async function runWithSpan<T>(
  name: string,
  fields: ObservabilityFields,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return getTracer().startActiveSpan(
    name,
    { attributes: toSpanAttributes(sanitizeLogFields(fields)) },
    async (span) => {
      try {
        return await fn(span);
      } catch (error) {
        recordSpanException(span, error);
        captureObservabilityException(error, {
          ...fields,
          spanName: name,
        });

        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export function toErrorLogFields(
  error: unknown,
): Pick<ObservabilityFields, "errorCode" | "errorMessage" | "errorSource"> {
  if (error instanceof Error) {
    return {
      errorCode: error.name,
      errorMessage: sanitizeErrorMessage(error.message),
      errorSource: "internal",
    };
  }

  if (typeof error === "string") {
    return {
      errorCode: null,
      errorMessage: sanitizeErrorMessage(error),
      errorSource: "internal",
    };
  }

  return {
    errorCode: null,
    errorMessage: "Unknown error",
    errorSource: "internal",
  };
}

export function captureObservabilityException(
  error: unknown,
  fields: ObservabilityFields = {},
): void {
  if (!sentryClient || isExpectedError(error)) {
    return;
  }

  const runtime = getObservabilityRuntime();
  const sanitizedFields = sanitizeLogFields(fields);
  const traceFields = getTraceFields();
  const traceUrl = getSentryTraceUrl(traceFields.trace_id);

  Sentry.withScope((scope) => {
    scope.setTag("service", runtime.serviceName);

    if (traceFields.trace_id) {
      scope.setTag("trace_id", traceFields.trace_id);
    }

    if (traceFields.span_id) {
      scope.setTag("span_id", traceFields.span_id);
    }

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

    scope.setContext("remora", {
      ...sanitizedFields,
      serviceName: runtime.serviceName,
      traceId: traceFields.trace_id,
      spanId: traceFields.span_id,
      traceUrl,
    });

    Sentry.captureException(error);
  });
}

export function registerProcessErrorCapture(): void {
  process.on("uncaughtExceptionMonitor", (error) => {
    captureObservabilityException(error, {
      errorSource: "process",
      errorCode: "UNCAUGHT_EXCEPTION",
    });
  });

  process.on("unhandledRejection", (reason) => {
    captureObservabilityException(reason, {
      errorSource: "process",
      errorCode: "UNHANDLED_REJECTION",
    });
  });
}

export function getActiveTraceResponseHeaders(): Record<string, string> {
  const traceFields = getTraceFields();
  const headers: Record<string, string> = {};

  if (traceFields.trace_id) {
    headers["x-remora-trace-id"] = traceFields.trace_id;
  }

  if (traceFields.span_id) {
    headers["x-remora-span-id"] = traceFields.span_id;
  }

  return headers;
}

function createLogger(serviceName: string): Logger {
  const options: LoggerOptions = {
    base: {
      service: serviceName,
    },
    level: process.env.LOG_LEVEL ?? "info",
    mixin() {
      return getTraceFields();
    },
    redact: {
      paths: [
        "*.authorization",
        "*.callbackToken",
        "*.callbackUrl",
        "*.cookie",
        "*.filePath",
        "*.password",
        "*.prompt",
        "*.rawPayload",
        "*.secret",
        "*.token",
        "*.url",
        "authorization",
        "callbackToken",
        "callbackUrl",
        "cookie",
        "filePath",
        "password",
        "prompt",
        "rawPayload",
        "secret",
        "token",
        "url",
      ],
      remove: true,
    },
  };

  return pino(options);
}

function createResource(serviceName: string): Resource {
  return new Resource({
    ...Resource.default().attributes,
    "service.name": serviceName,
  });
}

function initializeSentry({
  dsn,
  environment,
  release,
}: {
  dsn: string | null;
  environment: string;
  release: string | null;
}): Sentry.NodeClient | undefined {
  if (!dsn) {
    return undefined;
  }

  return Sentry.init({
    dsn,
    environment,
    release: release ?? undefined,
    sendDefaultPii: true,
    skipOpenTelemetrySetup: true,
    beforeSend: (event) => sanitizeSentryEvent(event),
  });
}

function createSpanProcessor(): SpanProcessor {
  if (!hasOtlpTraceEndpoint() || process.env.OTEL_TRACES_EXPORTER === "none") {
    return new NoopSpanProcessor();
  }

  return new BatchSpanProcessor(new OTLPTraceExporter());
}

function hasOtlpTraceEndpoint() {
  return Boolean(
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  );
}

function getResource(): Resource {
  return resource ?? createResource(defaultServiceName);
}

function getSpanProcessor(): SpanProcessor {
  return spanProcessor ?? new NoopSpanProcessor();
}

function getTracer() {
  return trace.getTracer("remora.backend");
}

function getTraceFields() {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (!spanContext || !isSpanContextValid(spanContext)) {
    return {};
  }

  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: `0${spanContext.traceFlags.toString(16)}`,
  };
}

function sanitizeLogFields(fields: ObservabilityFields): ObservabilityFields {
  const sanitized: ObservabilityFields = {};

  for (const [key, value] of Object.entries(fields)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    const sanitizedValue = sanitizeLogValue(value);

    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }

  return sanitized;
}

function sanitizeLogValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeErrorMessage(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeLogValue(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        continue;
      }

      const sanitizedValue = sanitizeLogValue(nestedValue);

      if (sanitizedValue !== undefined) {
        sanitized[key] = sanitizedValue;
      }
    }

    return sanitized;
  }

  return undefined;
}

function sanitizeErrorMessage(message: string): string {
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

function toSpanAttributes(fields: ObservabilityFields): Attributes {
  const attributes: Attributes = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      attributes[key] = value;
    }
  }

  return attributes;
}

function recordSpanException(span: Span, error: unknown): void {
  if (error instanceof Error) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: sanitizeErrorMessage(error.message),
    });

    return;
  }

  span.setStatus({
    code: SpanStatusCode.ERROR,
    message:
      typeof error === "string" ? sanitizeErrorMessage(error) : "Unknown error",
  });
}

function isExpectedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = error instanceof Error ? error.name : null;
  const code = "code" in error ? (error as { code?: unknown }).code : null;

  if (name && expectedErrorNames.has(name)) {
    if (name !== "TRPCError") {
      return true;
    }

    return typeof code === "string" && expectedTRPCCodes.has(code);
  }

  return typeof code === "string" && expectedTRPCCodes.has(code);
}

function getSentryTraceUrl(traceId: string | undefined): string | null {
  if (!traceId) {
    return null;
  }

  const template = parseBackendObservabilityEnv(
    process.env,
  ).SENTRY_TRACE_URL_TEMPLATE;

  return template?.replace("{traceId}", encodeURIComponent(traceId)) ?? null;
}

function sanitizeSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.message) {
    event.message = sanitizeErrorMessage(event.message);
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) => ({
      ...value,
      value:
        typeof value.value === "string"
          ? sanitizeErrorMessage(value.value)
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
  const sanitized = sanitizeLogValue(value);

  return isRecord(sanitized) ? sanitized : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
