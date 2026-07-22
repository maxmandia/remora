import type { AppRouter } from "@remora/backend/types";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:4000";

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
