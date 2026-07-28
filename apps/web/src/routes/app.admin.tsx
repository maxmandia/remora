import { useAuth } from "@remora/app/auth";
import { AdminSidebar } from "@remora/app/sidebar";
import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";

import { WebAppWorkspaceLayout } from "../components/web-app-workspace-layout";
import { createSeoHead } from "../lib/seo";

const adminPath = "/app/admin";

export const Route = createFileRoute("/app/admin")({
  component: AdminRoute,
  head: () =>
    createSeoHead({
      canonicalPath: "/app/admin",
      description: "Manage Remora administration.",
      index: false,
      title: "Admin",
    }),
});

function AdminRoute() {
  const { status, user } = useAuth();
  const navigate = useNavigate();

  if (status !== "signed-in" || !user?.isAdmin) {
    return <Navigate replace search={{}} to="/app" />;
  }

  return (
    <WebAppWorkspaceLayout
      mainAriaLabel="Admin workspace"
      sidebar={
        <AdminSidebar
          overviewHref={adminPath}
          isOverviewActive
          onSelectOverview={() => navigate({ to: adminPath })}
        />
      }
    >
      {/* TODO: shared ui for this across desktop later... */}
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-8 py-12">
        <h1 className="text-2xl font-medium">Admin</h1>
        <p className="text-muted-foreground text-sm">
          Admin tools are coming soon.
        </p>
      </section>
    </WebAppWorkspaceLayout>
  );
}
