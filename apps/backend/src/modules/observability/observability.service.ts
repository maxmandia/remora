import { trace, isSpanContextValid, SpanStatusCode } from "@opentelemetry/api";
import type { Attributes, Span } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { Span as SdkSpan } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OpenTelemetryPlugin } from "@temporalio/interceptors-opentelemetry";
import { createRequire } from "node:module";
import type { Context } from "@opentelemetry/api";
import type { Logger, LoggerOptions } from "pino";

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
const sensitiveKeyPattern =
  /(authorization|cookie|password|payload|prompt|secret|token|url|api.?key)/i;

let runtime: ObservabilityRuntime | null = null;
let tracerProvider: NodeTracerProvider | null = null;
let spanProcessor: SpanProcessor | null = null;
let resource: Resource | null = null;

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

export function initializeObservability({
  serviceName,
}: ObservabilityInitOptions): ObservabilityRuntime {
  if (runtime) {
    return runtime;
  }

  resource = createResource(serviceName);
  spanProcessor = createSpanProcessor();
  tracerProvider = new NodeTracerProvider({
    resource,
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

  tracerProvider.register();

  runtime = {
    logger: createLogger(serviceName),
    serviceName,
  };

  return runtime;
}

export function getObservabilityRuntime(): ObservabilityRuntime {
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

        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export function toErrorLogFields(
  error: unknown,
): Pick<
  ObservabilityFields,
  "errorCode" | "errorMessage" | "errorSource"
> {
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
  const withoutUrls = message.replace(urlPattern, "[redacted-url]");

  if (withoutUrls.length <= errorMessageMaxLength) {
    return withoutUrls;
  }

  return `${withoutUrls.slice(0, errorMessageMaxLength)}...`;
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
