import { OpenAIProviderError } from "./openai.types.ts";

export function toOpenAIProviderErrorLogFields(
  error: unknown,
): Record<string, string | number | boolean | null> {
  if (!(error instanceof OpenAIProviderError)) {
    return {};
  }

  return {
    errorCode: error.code,
    errorSource: "provider",
    providerStatusCode: error.statusCode,
    providerRequestId: error.requestId,
    providerMessage: error.providerMessage,
    providerRetryable: error.retryable,
  };
}

export function toOpenAIProviderFailureDetails(error: OpenAIProviderError) {
  return {
    code: error.code,
    statusCode: error.statusCode,
    requestId: error.requestId,
    retryable: error.retryable,
    providerMessage: error.providerMessage,
  };
}
