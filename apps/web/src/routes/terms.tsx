import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "../components/terms-page";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () =>
    createSeoHead({
      canonicalPath: "/terms",
      description: "Terms governing use of the Remora desktop application.",
      title: "Terms of Service | Remora",
    }),
});
