import { useAuth } from "@remora/app/auth";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";

import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/app/admin")({
  component: WebAdminRoute,
  head: () =>
    createSeoHead({
      canonicalPath: "/app/admin",
      description: "Manage Remora administration.",
      index: false,
      title: "Admin",
    }),
});

function WebAdminRoute() {
  const { impersonatedBy, status, user } = useAuth();

  if (status !== "signed-in" || user?.role !== "admin" || impersonatedBy) {
    return <Navigate replace search={{}} to="/app" />;
  }

  return <Outlet />;
}
