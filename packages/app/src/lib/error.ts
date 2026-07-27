import { isTRPCClientError, type TRPCClientErrorLike } from "@trpc/client";

import type { AppRouter } from "@remora/backend/types";

export type AppTRPCError = TRPCClientErrorLike<AppRouter>;

export const defaultErrorToastMessage =
  "Something went wrong. Please try again.";

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = defaultErrorToastMessage,
) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

export function isAppTRPCError(error: unknown): error is AppTRPCError {
  return isTRPCClientError<AppRouter>(error);
}
