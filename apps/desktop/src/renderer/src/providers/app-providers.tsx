import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TooltipProvider } from "@remora/ui";
import { useState, type ReactNode } from "react";

import type { AppRouter } from "@remora/backend/types";

import { desktopTrpcFetch } from "../lib/trpc-bridge-fetch.ts";
import { TRPCProvider } from "../lib/trpc.ts";
import { AuthProvider } from "./auth-provider.tsx";
import { HotkeysProvider } from "./hotkeys-provider.tsx";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: "/trpc",
          fetch: desktopTrpcFetch,
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <AuthProvider>
          <HotkeysProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </HotkeysProvider>
        </AuthProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
