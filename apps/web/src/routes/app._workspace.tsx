import { parseGenerationWorkspaceSearch } from "@remora/app/generation-workspace-search";
import { createFileRoute } from "@tanstack/react-router";

import { WebGenerationRoute } from "../components/web-generation-route";

export const Route = createFileRoute("/app/_workspace")({
  component: WebGenerationRoute,
  validateSearch: parseGenerationWorkspaceSearch,
});
