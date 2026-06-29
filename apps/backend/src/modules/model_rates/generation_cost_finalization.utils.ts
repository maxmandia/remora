import {
  GenerationJobFinalCostCalculationError,
  type GenerationCostLineItem,
  type GenerationJobEstimatedCostSnapshot,
  type GenerationJobFinalCost,
  type GenerationJobProviderCost,
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

  const lineItem = getProviderCompletionTokenLineItem(estimatedCostSnapshot);

  const surchargeBasisPoints =
    estimatedCostSnapshot.surcharge.surchargeBasisPoints;

  if (!Number.isFinite(surchargeBasisPoints) || surchargeBasisPoints < 0) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot surcharge policy cannot be finalized",
    );
  }

  const baseCostUsdMicros = calculateProviderUsageCostUsdMicros({
    completionTokens,
    lineItem,
  });

  const surchargeUsdMicros = calculateSurchargeUsdMicros({
    baseCostUsdMicros,
    surchargeBasisPoints,
  });

  return {
    finalCostUsdMicros: baseCostUsdMicros + surchargeUsdMicros,
    finalCostBasis: "provider_usage",
  };
}

export function calculateGenerationJobProviderCostFromProviderUsage({
  completionTokens,
  estimatedCostSnapshot,
  providerModelId,
  providerTaskId,
  totalTokens,
}: {
  completionTokens: number | null | undefined;
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot;
  providerModelId: string | null;
  providerTaskId: string;
  totalTokens: number | null | undefined;
}): GenerationJobProviderCost {
  if (
    typeof completionTokens !== "number" ||
    !Number.isFinite(completionTokens) ||
    completionTokens < 0
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Provider completion token usage is required to accrue generation job provider cost",
    );
  }

  if (
    totalTokens !== null &&
    totalTokens !== undefined &&
    (typeof totalTokens !== "number" ||
      !Number.isFinite(totalTokens) ||
      totalTokens < 0)
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Provider total token usage cannot be invalid when accruing generation job provider cost",
    );
  }

  const lineItem = getProviderCompletionTokenLineItem(estimatedCostSnapshot);
  const providerCostUsdMicros = calculateProviderUsageCostUsdMicros({
    completionTokens,
    lineItem,
  });

  return {
    providerCostUsdMicros,
    providerCostSnapshot: {
      schemaVersion: 1,
      source: "provider_usage",
      provider: "byteplus",
      providerTaskId,
      providerModelId,
      usage: {
        completionTokens,
        totalTokens: totalTokens ?? null,
      },
      lineItem: {
        rateId: lineItem.rateId,
        component: lineItem.component,
        finalQuantitySource: "provider_completion_tokens",
        quantityUnit: lineItem.quantityUnit,
        unitQuantity: lineItem.unitQuantity,
        unitPriceUsdMicros: lineItem.unitPriceUsdMicros,
        amountUsdMicros: providerCostUsdMicros,
      },
      amountUsdMicros: providerCostUsdMicros,
    },
  };
}

function getProviderCompletionTokenLineItem(
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot,
) {
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

  return lineItem;
}

function calculateProviderUsageCostUsdMicros({
  completionTokens,
  lineItem,
}: {
  completionTokens: number;
  lineItem: GenerationCostLineItem;
}) {
  return Math.ceil(
    (completionTokens * lineItem.unitPriceUsdMicros) / lineItem.unitQuantity,
  );
}
