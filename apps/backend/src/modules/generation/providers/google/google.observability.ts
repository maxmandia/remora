import { GoogleProviderError } from "./google.types.ts";

export function toGoogleProviderErrorLogFields(
  error: unknown,
): Record<string, string | number | null> {
  if (!(error instanceof GoogleProviderError)) {
    return {};
  }

  return {
    errorCode: error.code,
    errorSource: "provider",
    providerStatusCode: error.statusCode,
    providerMessage:
      error.diagnostics?.providerMessage ?? error.providerMessage,
    providerInteractionId: error.diagnostics?.interactionId ?? null,
    providerInteractionStatus:
      error.diagnostics?.interactionStatus ?? error.interactionStatus ?? null,
    providerResponseStepTypes: error.diagnostics?.stepTypes.join(",") ?? null,
    providerResponseContentTypes:
      error.diagnostics?.contentTypes.join(",") ?? null,
    providerResponseImageCount: error.diagnostics?.imageCount ?? null,
  };
}

export function toGoogleProviderFailureDetails(error: GoogleProviderError) {
  return {
    statusCode: error.statusCode,
    providerMessage: error.providerMessage,
    diagnostics: error.diagnostics ?? null,
  };
}
