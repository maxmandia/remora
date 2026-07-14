import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "../components/terms-page";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service | Remora" },
      {
        name: "description",
        content: "Terms governing use of the Remora desktop application.",
      },
    ],
  }),
});
