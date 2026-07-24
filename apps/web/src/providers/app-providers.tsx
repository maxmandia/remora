import { HotkeysProvider } from "@remora/app/hotkeys";
import { useAppQueryClient } from "@remora/app/query";
import { Toaster } from "@remora/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = useAppQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <HotkeysProvider>{children}</HotkeysProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
