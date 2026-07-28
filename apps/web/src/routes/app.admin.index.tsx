import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/admin/")({
  component: AdminIndexRoute,
});

function AdminIndexRoute() {
  return <Navigate replace search={{}} to="/app/admin/impersonation" />;
}
