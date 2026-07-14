import { createFileRoute } from "@tanstack/react-router";

import { SupportPage } from "../components/support-page";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Support | Remora" },
      {
        name: "description",
        content: "Get help with the Remora desktop application.",
      },
    ],
  }),
});
