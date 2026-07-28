import { AccountImpersonationPage } from "@remora/app/admin";
import { useAuth } from "@remora/app/auth";
import { AdminSidebar } from "@remora/app/sidebar";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppWorkspaceLayout } from "../layouts/app-workspace-layout.tsx";
import { accountImpersonationAdapter } from "../lib/account-impersonation-adapter.ts";
import { BlankRouteSurface } from "./blank-route-surface.tsx";

const impersonationPath = "/app/admin/impersonation";

export function AdminImpersonationRoute() {
  const { impersonatedBy, status, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin =
    status === "signed-in" && user?.role === "admin" && !impersonatedBy;

  useEffect(() => {
    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
      return;
    }

    if (status === "signed-in" && !isAdmin) {
      void navigate({ to: "/app", replace: true });
    }
  }, [isAdmin, navigate, status]);

  if (!isAdmin || !user) {
    return <BlankRouteSurface status={status} user={user} />;
  }

  return (
    <AppWorkspaceLayout
      data-auth-status={status}
      data-user-id={user.id}
      mainAriaLabel="Admin workspace"
      sidebar={
        <AdminSidebar
          impersonationHref={impersonationPath}
          isImpersonationActive
          onSelectImpersonation={() => navigate({ to: impersonationPath })}
        />
      }
    >
      <AccountImpersonationPage
        adapter={accountImpersonationAdapter}
        onImpersonated={() => navigate({ to: "/app" })}
      />
    </AppWorkspaceLayout>
  );
}
