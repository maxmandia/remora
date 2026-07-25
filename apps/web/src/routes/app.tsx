import { parseGenerationWorkspaceSearch } from "@remora/app/generation";
import { Outlet, createFileRoute } from "@tanstack/react-router";

import { createSeoHead } from "../lib/seo";
import { AppProviders } from "../providers/app-providers";

export const Route = createFileRoute("/app")({
  component: AppLayout,
  validateSearch: parseGenerationWorkspaceSearch,
  head: () =>
    createSeoHead({
      canonicalPath: "/app",
      description: "Use Remora in your browser.",
      index: false,
      title: "Remora",
    }),
});

function AppLayout() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}
