import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Toaster, TooltipProvider } from "@remora/ui";
import { useState, type ReactNode } from "react";

import type { AppRouter } from "@remora/backend/types";

import { useAppQueryClient } from "../hooks/use-app-query-client.ts";
import { desktopTrpcFetch } from "../lib/trpc-bridge-fetch.ts";
import { TRPCProvider } from "../lib/trpc.ts";
import { AuthProvider } from "./auth-provider.tsx";
import { HotkeysProvider } from "./hotkeys-provider.tsx";
import { RealtimeQueryInvalidationProvider } from "./realtime-query-invalidation-provider.tsx";

export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = useAppQueryClient();
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
          <RealtimeQueryInvalidationProvider>
            <HotkeysProvider>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster />
            </HotkeysProvider>
          </RealtimeQueryInvalidationProvider>
        </AuthProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
