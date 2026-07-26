import { createFileRoute } from "@tanstack/react-router";

import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/app/settings/credits")({
  head: () =>
    createSeoHead({
      canonicalPath: "/app/settings/credits",
      description: "Manage your Remora credits.",
      index: false,
      title: "Credits | Remora",
    }),
});
