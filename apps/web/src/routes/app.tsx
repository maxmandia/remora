import { parseGenerationWorkspaceSearch } from "@remora/app/generation";
import { createFileRoute } from "@tanstack/react-router";

import { WebAppRoute } from "../components/web-app-route";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/app")({
  component: WebAppRoute,
  validateSearch: parseGenerationWorkspaceSearch,
  head: () =>
    createSeoHead({
      canonicalPath: "/app",
      description: "Use Remora in your browser.",
      index: false,
      title: "Remora",
    }),
});
