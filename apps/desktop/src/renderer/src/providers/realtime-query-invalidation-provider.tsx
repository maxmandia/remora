import { RealtimeQueryInvalidationProvider as SharedRealtimeQueryInvalidationProvider } from "@remora/app/realtime";

import { realtimeBridge } from "../lib/realtime-bridge.ts";
import { useAuth } from "./auth-provider.tsx";

import type { ReactNode } from "react";

export function RealtimeQueryInvalidationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { status } = useAuth();

  return (
    <SharedRealtimeQueryInvalidationProvider
      client={realtimeBridge}
      enabled={status === "signed-in"}
    >
      {children}
    </SharedRealtimeQueryInvalidationProvider>
  );
}
