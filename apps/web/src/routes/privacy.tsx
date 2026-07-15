import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPage } from "../components/privacy-page";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy | Remora" },
      {
        name: "description",
        content:
          "How Remora Industries collects, uses, and protects personal data.",
      },
    ],
  }),
});
