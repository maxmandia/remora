import { useAuth } from "@remora/app/auth";
import { AdminSidebar } from "@remora/app/sidebar";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppWorkspaceLayout } from "../layouts/app-workspace-layout.tsx";
import { BlankRouteSurface } from "./blank-route-surface.tsx";

const adminPath = "/app/admin";

export function AdminRoute() {
  const { status, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = status === "signed-in" && user?.isAdmin === true;

  useEffect(() => {
    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
      return;
    }

    if (status === "signed-in" && !user?.isAdmin) {
      void navigate({ to: "/app", replace: true });
    }
  }, [navigate, status, user?.isAdmin]);

  if (!isAdmin) {
    return <BlankRouteSurface status={status} user={user} />;
  }

  return (
    <AppWorkspaceLayout
      data-auth-status={status}
      data-user-id={user.id}
      mainAriaLabel="Admin workspace"
      sidebar={
        <AdminSidebar
          overviewHref={adminPath}
          isOverviewActive
          onSelectOverview={() => navigate({ to: adminPath })}
        />
      }
    >
      <AdminPlaceholder />
    </AppWorkspaceLayout>
  );
}

function AdminPlaceholder() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-8 py-12">
      <h1 className="text-2xl font-medium">Admin</h1>
      <p className="text-muted-foreground text-sm">
        Admin tools are coming soon.
      </p>
    </section>
  );
}
