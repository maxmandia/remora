import { useAuth } from "@remora/app/auth";
import { RealtimeQueryInvalidationProvider as SharedRealtimeQueryInvalidationProvider } from "@remora/app/realtime";

import { realtimeClient } from "../clients/realtime";

import type { ReactNode } from "react";

export function RealtimeQueryInvalidationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { impersonatedBy, status, user } = useAuth();

  return (
    <SharedRealtimeQueryInvalidationProvider
      client={realtimeClient}
      enabled={status === "signed-in"}
      identityKey={user ? `${user.id}:${impersonatedBy ?? ""}` : null}
    >
      {children}
    </SharedRealtimeQueryInvalidationProvider>
  );
}
