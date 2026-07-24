import { HotkeysProvider } from "@remora/app/hotkeys";
import { useAppQueryClient } from "@remora/app/query";
import { TRPCProvider } from "@remora/app/trpc";
import { Toaster } from "@remora/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { trpcClient } from "../clients/trpc";
import { AuthProvider } from "./auth-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = useAppQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <AuthProvider>
          <HotkeysProvider>{children}</HotkeysProvider>
        </AuthProvider>
      </TRPCProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
