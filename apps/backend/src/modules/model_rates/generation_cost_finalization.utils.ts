import {
  GenerationJobFinalCostCalculationError,
  type GenerationJobEstimatedCostSnapshot,
  type GenerationJobFinalCost,
} from "./model_rates.types.ts";
import { calculateSurchargeUsdMicros } from "./model_rates.utils.ts";

export function calculateGenerationJobFinalCostFromProviderUsage({
  completionTokens,
  estimatedCostSnapshot,
}: {
  completionTokens: number | null | undefined;
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot;
}): GenerationJobFinalCost {
  if (
    typeof completionTokens !== "number" ||
    !Number.isFinite(completionTokens) ||
    completionTokens < 0
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Provider completion token usage is required to finalize generation job cost",
    );
  }

  if (!Array.isArray(estimatedCostSnapshot.lineItems)) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot line items cannot be finalized",
    );
  }

  const finalLineItems = estimatedCostSnapshot.lineItems.filter(
    (lineItem) => lineItem.finalQuantitySource === "provider_completion_tokens",
  );
  const lineItem = finalLineItems[0];

  if (finalLineItems.length !== 1 || !lineItem) {
    throw new GenerationJobFinalCostCalculationError(
      `Generation job cost snapshot must include exactly one provider completion token line item, found ${finalLineItems.length}`,
    );
  }

  const surchargeBasisPoints =
    estimatedCostSnapshot.surcharge.surchargeBasisPoints;

  if (!Number.isFinite(surchargeBasisPoints) || surchargeBasisPoints < 0) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot surcharge policy cannot be finalized",
    );
  }

  if (
    !Number.isFinite(lineItem.unitQuantity) ||
    lineItem.unitQuantity <= 0 ||
    !Number.isFinite(lineItem.unitPriceUsdMicros) ||
    lineItem.unitPriceUsdMicros < 0
  ) {
    throw new GenerationJobFinalCostCalculationError(
      `Generation job cost snapshot line item cannot be finalized: ${lineItem.rateId}`,
    );
  }

  const baseCostUsdMicros = Math.ceil(
    (completionTokens * lineItem.unitPriceUsdMicros) / lineItem.unitQuantity,
  );

  const surchargeUsdMicros = calculateSurchargeUsdMicros({
    baseCostUsdMicros,
    surchargeBasisPoints,
  });

  return {
    finalCostUsdMicros: baseCostUsdMicros + surchargeUsdMicros,
    finalCostBasis: "provider_usage",
  };
}
