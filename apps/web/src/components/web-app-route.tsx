import { useAuth } from "@remora/app/auth";
import { ClientOnly, Outlet } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { AppProviders } from "../providers/app-providers";

export function WebAppRoute() {
  return (
    <AppProviders>
      <ClientOnly>
        <AuthenticatedAppRoute />
      </ClientOnly>
    </AppProviders>
  );
}

function AuthenticatedAppRoute() {
  const { requestAuth, status, user } = useAuth();

  useEffect(() => {
    if (status === "signed-out" || (status === "signed-in" && !user)) {
      void requestAuth();
    }
  }, [requestAuth, status, user]);

  if (status === "loading") {
    return (
      <FullPageWorkspaceStatus>Resolving session...</FullPageWorkspaceStatus>
    );
  }

  if (status === "signed-out" || !user) {
    return (
      <FullPageWorkspaceStatus>
        Redirecting to sign in...
      </FullPageWorkspaceStatus>
    );
  }

  return <Outlet />;
}

function FullPageWorkspaceStatus({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-4">{children}</div>
    </main>
  );
}
