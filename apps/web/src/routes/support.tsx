import { createFileRoute } from "@tanstack/react-router";

import { SupportPage } from "../components/support-page";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () =>
    createSeoHead({
      canonicalPath: "/support",
      description: "Get help with the Remora desktop application.",
      title: "Support | Remora",
    }),
});
