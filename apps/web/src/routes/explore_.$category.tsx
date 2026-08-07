import {
  creativeCategoryDetails,
  isCreativeCategory,
} from "@remora/app/explore";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { WebExploreRoute } from "../components/web-explore-route";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/explore_/$category")({
  loader: ({ params }) => {
    if (!isCreativeCategory(params.category)) {
      throw notFound();
    }

    return params.category;
  },
  component: ExploreCategoryRoute,
  head: ({ loaderData }) => {
    const category = loaderData
      ? creativeCategoryDetails[loaderData]
      : undefined;

    return createSeoHead({
      canonicalPath: category ? `/explore/${loaderData}` : "/explore",
      description: category?.description ?? "Explore creative work in Remora.",
      title: category ? `Explore ${category.label}` : "Explore creative work",
    });
  },
});

function ExploreCategoryRoute() {
  const category = Route.useLoaderData();

  return <WebExploreRoute category={category} />;
}
