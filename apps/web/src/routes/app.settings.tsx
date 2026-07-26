import { createFileRoute } from "@tanstack/react-router";

import { WebSettingsRoute } from "../components/web-settings-route";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/app/settings")({
  component: WebSettingsRoute,
  head: () =>
    createSeoHead({
      canonicalPath: "/app/settings",
      description: "Manage your Remora settings.",
      index: false,
      title: "Settings",
    }),
});
