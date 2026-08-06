import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "../components/terms-page";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () =>
    createSeoHead({
      canonicalPath: "/terms",
      description: "Terms governing use of Remora and its services.",
      title: "Terms of Service",
    }),
});
