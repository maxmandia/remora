import { createFileRoute } from "@tanstack/react-router";

import { PricingPage } from "../components/pricing-page";
import { fetchPublicPricing } from "../lib/public-pricing";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/pricing")({
  component: PricingRoute,
  head: () =>
    createSeoHead({
      canonicalPath: "/pricing",
      description:
        "See Remora's transparent generative media pricing: upstream provider cost plus one clearly itemized flat fee.",
      title: "Transparent Pricing | Remora",
    }),
  loader: async () => {
    try {
      return await fetchPublicPricing();
    } catch (error) {
      console.error("Unable to load public pricing", error);
      return null;
    }
  },
  staleTime: 5 * 60 * 1000,
});

function PricingRoute() {
  return <PricingPage catalog={Route.useLoaderData()} />;
}
