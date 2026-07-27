import type { AppRouter } from "@remora/backend/types";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

import { apiOrigin } from "../lib/api-origin";

type TrpcClient = ReturnType<typeof createTRPCClient<AppRouter>>;

export const trpcClient: TrpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiOrigin}/trpc`,
      fetch: (url, options) =>
        globalThis.fetch(url, {
          ...options,
          credentials: "include",
        }),
    }),
  ],
});
