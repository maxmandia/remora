import { useAuth } from "@remora/app/auth";
import { HotkeysProvider } from "@remora/app/hotkeys";
import { useAppQueryClient } from "@remora/app/query";
import { Toaster, TooltipProvider } from "@remora/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Fragment, useState, type ReactNode } from "react";

import type { AppRouter } from "@remora/backend/types";

import { TRPCProvider } from "@remora/app/trpc";
import { desktopTrpcFetch } from "../lib/trpc-bridge-fetch.ts";
import { AuthProvider } from "./auth-provider.tsx";
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
          <IdentityBoundary>
            <RealtimeQueryInvalidationProvider>
              <HotkeysProvider>
                <TooltipProvider>{children}</TooltipProvider>
                <Toaster />
              </HotkeysProvider>
            </RealtimeQueryInvalidationProvider>
          </IdentityBoundary>
        </AuthProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}

function IdentityBoundary({ children }: { children: ReactNode }) {
  const { impersonatedBy, user } = useAuth();
  // Remount the tree when the effective identity changes so provider and route
  // state cannot leak across impersonation start/stop or account switches.
  const identityKey = `${user?.id ?? "signed-out"}:${impersonatedBy ?? ""}`;

  return <Fragment key={identityKey}>{children}</Fragment>;
}
