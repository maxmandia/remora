import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPage } from "../components/privacy-page";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () =>
    createSeoHead({
      canonicalPath: "/privacy",
      description:
        "How Remora Industries collects, uses, and protects personal data.",
      title: "Privacy Policy | Remora",
    }),
});
