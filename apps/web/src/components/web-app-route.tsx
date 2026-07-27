import { useAuth } from "@remora/app/auth";
import {
  ClientOnly,
  Navigate,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppProviders } from "../providers/app-providers";

export function WebAppRoute() {
  return (
    <AppProviders>
      <ClientOnly>
        <ResolvedAppRoute />
      </ClientOnly>
    </AppProviders>
  );
}

function ResolvedAppRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <FullPageWorkspaceStatus>Resolving session...</FullPageWorkspaceStatus>
    );
  }

  if (!isAppLocation(location.pathname)) {
    return null;
  }

  if (status === "signed-out" && !isCleanGuestWorkspaceLocation(location)) {
    return <Navigate replace search={{}} to="/app" />;
  }

  return <Outlet />;
}

function isAppLocation(pathname: string) {
  return (
    pathname === "/app" || pathname === "/app/" || pathname.startsWith("/app/")
  );
}

function isCleanGuestWorkspaceLocation(location: {
  pathname: string;
  search: Record<string, unknown>;
}) {
  return (
    (location.pathname === "/app" || location.pathname === "/app/") &&
    !location.search.projectId
  );
}

function FullPageWorkspaceStatus({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-4">{children}</div>
    </main>
  );
}
