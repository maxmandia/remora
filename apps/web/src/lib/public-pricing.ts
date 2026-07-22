import type { PublicGenerationPricingCatalog } from "@remora/domain/generation-pricing/dto";

import { trpcClient } from "../clients/trpc";

export type PublicPricingCatalog = PublicGenerationPricingCatalog;

export function fetchPublicPricing(): Promise<PublicPricingCatalog> {
  return trpcClient.modelRates.listPublicPricing.query();
}
