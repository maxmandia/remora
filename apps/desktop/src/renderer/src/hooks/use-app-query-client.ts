import { toast } from "@remora/ui";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { getUserFacingErrorMessage, isAppTRPCError } from "../lib/error.ts";

type ErrorToastMeta = {
  suppressErrorToast?: boolean;
};

export function useAppQueryClient() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            showTRPCErrorToast(error, query.meta);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            showTRPCErrorToast(error, mutation.meta);
          },
        }),
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return queryClient;
}

function showTRPCErrorToast(error: unknown, meta: unknown) {
  if (shouldSuppressErrorToast(meta) || !isAppTRPCError(error)) {
    return;
  }

  toast.message("An error occurred", {
    description: getUserFacingErrorMessage(error),
  });
}

function shouldSuppressErrorToast(meta: unknown) {
  return (
    typeof meta === "object" &&
    meta !== null &&
    (meta as ErrorToastMeta).suppressErrorToast === true
  );
}
