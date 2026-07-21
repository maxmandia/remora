import type {
  GenerationJobTerminalError,
  GenerationProviderTaskStatus,
} from "../modules/generation/generation.types.ts";
import type {
  CreateGenerationWorkflowInput,
  GenerationProviderCallback,
} from "./types.ts";

type GenerationProviderResultCallback = Extract<
  GenerationProviderCallback,
  { kind: "result" }
>;

type CallbackGenerationWorkflowInput = Extract<
  CreateGenerationWorkflowInput,
  { providerExecution: { mode: "callback" } }
>;

export function usesCallbackProviderExecution(
  input: CreateGenerationWorkflowInput,
): input is CallbackGenerationWorkflowInput {
  return input.providerExecution.mode === "callback";
}

export function isTerminalProviderStatus(status: GenerationProviderTaskStatus) {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

export function isTerminalProviderCallback(
  callback: GenerationProviderCallback,
) {
  return (
    callback.kind === "malformed" ||
    isTerminalProviderStatus(callback.result.status)
  );
}

export function serializeProviderResultError(
  status: GenerationProviderTaskStatus,
  callback: GenerationProviderResultCallback,
): GenerationJobTerminalError {
  return {
    source: "provider",
    code: callback.result.providerError?.code ?? status.toUpperCase(),
    message:
      callback.result.providerError?.message ?? `Provider task ${status}`,
  };
}

export function serializeProviderError(
  error: unknown,
): GenerationJobTerminalError {
  const providerError = findErrorDetails(error);

  return {
    source: "provider",
    code: providerError.code,
    message: providerError.message,
  };
}

export function serializeFinalCostCalculationError(
  error: unknown,
): GenerationJobTerminalError {
  const details = findErrorDetails(error);

  return {
    source: "internal",
    code: "FINAL_COST_CALCULATION_FAILED",
    message: details.message ?? "Final generation cost could not be calculated",
  };
}

function findErrorDetails(error: unknown): {
  code: string | null;
  message: string | null;
} {
  const visited = new Set<unknown>();
  let current = error;

  while (current && !visited.has(current)) {
    visited.add(current);

    const code =
      readStringProperty(current, "code") ??
      readStringProperty(current, "type");
    const providerMessage = readStringProperty(current, "providerMessage");
    const message = providerMessage ?? readStringProperty(current, "message");

    if (code || providerMessage) {
      return {
        code,
        message,
      };
    }

    current = readUnknownProperty(current, "cause");
  }

  if (error instanceof Error) {
    return {
      code: error.name,
      message: error.message,
    };
  }

  return {
    code: null,
    message: typeof error === "string" ? error : "Unknown provider task error",
  };
}

function readStringProperty(value: unknown, key: string) {
  const property = readUnknownProperty(value, key);

  return typeof property === "string" ? property : null;
}

function readUnknownProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}
