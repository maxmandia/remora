import { createFileRoute } from "@tanstack/react-router";

import { WebAppRoute } from "../components/web-app-route";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/app")({
  component: WebAppRoute,
  head: () =>
    createSeoHead({
      canonicalPath: "/app",
      description: "Use Remora in your browser.",
      index: false,
      title: "Remora",
    }),
});
