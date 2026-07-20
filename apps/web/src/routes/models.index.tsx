import { createFileRoute } from "@tanstack/react-router";

import { ModelsPage } from "../components/models-page";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/models/")({
  component: ModelsPage,
  head: () =>
    createSeoHead({
      canonicalPath: "/models",
      description:
        "Explore image and video generation models, their variants, capabilities, and practical controls.",
      title: "Generative media models | Remora",
    }),
});
