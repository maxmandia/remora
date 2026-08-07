import { createFileRoute } from "@tanstack/react-router";

import { WebExploreRoute } from "../components/web-explore-route";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/explore")({
  component: WebExploreRoute,
  head: () =>
    createSeoHead({
      canonicalPath: "/explore",
      description:
        "Explore creative directions for generative film, advertising, and art.",
      title: "Explore creative work",
    }),
});
