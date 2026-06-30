import type { Logger } from "pino";

export type ObservabilityRuntime = {
  logger: Logger;
  serviceName: string;
};

export type ObservabilityInitOptions = {
  serviceName: string;
};

export type LogLevel = "debug" | "info" | "warn" | "error";

export type ObservabilityFields = {
  durationMs?: number | null;
  errorSource?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  [key: string]: unknown;
};
