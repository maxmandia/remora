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

export function calculateGenerationJobFinalCostFromPricingFormula({
  estimatedCostSnapshot,
}: {
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot;
}): GenerationJobFinalCost {
  validatePricingFormulaEstimatedCostSnapshot(estimatedCostSnapshot);

  return {
    finalCostUsdMicros: estimatedCostSnapshot.estimatedCostUsdMicros,
    finalCostBasis: "pricing_formula",
  };
}

export function calculateKlingGenerationJobProviderCostFromPricingFormula({
  estimatedCostSnapshot,
  providerModelId,
  providerTaskId,
}: {
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot;
  providerModelId: string | null;
  providerTaskId: string;
}): GenerationJobProviderCost {
  validatePricingFormulaEstimatedCostSnapshot(estimatedCostSnapshot);

  return {
    providerCostUsdMicros: estimatedCostSnapshot.baseCostUsdMicros,
    providerCostSnapshot: {
      schemaVersion: 1,
      source: "pricing_formula",
      provider: "kling",
      providerTaskId,
      providerModelId,
      lineItems: estimatedCostSnapshot.lineItems.map((lineItem) => ({
        rateId: lineItem.rateId,
        component: lineItem.component,
        quantitySource: lineItem.quantitySource,
        finalQuantitySource: null,
        quantity: lineItem.quantity,
        quantityUnit: lineItem.quantityUnit,
        unitQuantity: lineItem.unitQuantity,
        unitPriceUsdMicros: lineItem.unitPriceUsdMicros,
        amountUsdMicros: lineItem.estimatedCostUsdMicros,
      })),
      amountUsdMicros: estimatedCostSnapshot.baseCostUsdMicros,
    },
  };
}

function validatePricingFormulaEstimatedCostSnapshot(
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot,
) {
  if (
    !estimatedCostSnapshot ||
    typeof estimatedCostSnapshot !== "object" ||
    (estimatedCostSnapshot.schemaVersion !== 1 &&
      estimatedCostSnapshot.schemaVersion !== 2)
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot schema version cannot be finalized from its pricing formula",
    );
  }

  if (
    !Array.isArray(estimatedCostSnapshot.lineItems) ||
    estimatedCostSnapshot.lineItems.length === 0
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot must include pricing formula line items",
    );
  }

  let baseCostUsdMicros = 0;

  for (const lineItem of estimatedCostSnapshot.lineItems) {
    const lineItemRateId =
      lineItem &&
      typeof lineItem === "object" &&
      typeof lineItem.rateId === "string"
        ? lineItem.rateId
        : "unknown";

    if (
      !lineItem ||
      typeof lineItem !== "object" ||
      typeof lineItem.rateId !== "string" ||
      lineItem.rateId.length === 0 ||
      lineItem.finalQuantitySource !== null ||
      !Number.isFinite(lineItem.quantity) ||
      lineItem.quantity <= 0 ||
      !Number.isFinite(lineItem.unitQuantity) ||
      lineItem.unitQuantity <= 0 ||
      !isValidUsdMicros(lineItem.unitPriceUsdMicros) ||
      !isValidUsdMicros(lineItem.estimatedCostUsdMicros)
    ) {
      throw new GenerationJobFinalCostCalculationError(
        `Generation job cost snapshot pricing formula line item cannot be finalized: ${lineItemRateId}`,
      );
    }

    const expectedCostUsdMicros = Math.ceil(
      (lineItem.quantity * lineItem.unitPriceUsdMicros) / lineItem.unitQuantity,
    );

    if (
      !isValidUsdMicros(expectedCostUsdMicros) ||
      lineItem.estimatedCostUsdMicros !== expectedCostUsdMicros
    ) {
      throw new GenerationJobFinalCostCalculationError(
        `Generation job cost snapshot pricing formula line item amount cannot be finalized: ${lineItem.rateId}`,
      );
    }

    baseCostUsdMicros += lineItem.estimatedCostUsdMicros;
  }

  if (
    !isValidUsdMicros(baseCostUsdMicros) ||
    !isValidUsdMicros(estimatedCostSnapshot.baseCostUsdMicros) ||
    estimatedCostSnapshot.baseCostUsdMicros !== baseCostUsdMicros
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot pricing formula base cost cannot be finalized",
    );
  }

  if (
    !estimatedCostSnapshot.surcharge ||
    typeof estimatedCostSnapshot.surcharge !== "object"
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot pricing formula surcharge cannot be finalized",
    );
  }

  const surchargeBasisPoints =
    estimatedCostSnapshot.surcharge.surchargeBasisPoints;
  const surchargeUsdMicros = estimatedCostSnapshot.surcharge.surchargeUsdMicros;

  if (
    !Number.isSafeInteger(surchargeBasisPoints) ||
    surchargeBasisPoints < 0 ||
    !isValidUsdMicros(surchargeUsdMicros) ||
    surchargeUsdMicros !==
      calculateSurchargeUsdMicros({
        baseCostUsdMicros,
        surchargeBasisPoints,
      })
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot pricing formula surcharge cannot be finalized",
    );
  }

  const estimatedCostUsdMicros = baseCostUsdMicros + surchargeUsdMicros;

  if (
    !isValidUsdMicros(estimatedCostUsdMicros) ||
    !isValidUsdMicros(estimatedCostSnapshot.estimatedCostUsdMicros) ||
    estimatedCostSnapshot.estimatedCostUsdMicros !== estimatedCostUsdMicros
  ) {
    throw new GenerationJobFinalCostCalculationError(
      "Generation job cost snapshot pricing formula estimated cost cannot be finalized",
    );
  }
}

function isValidUsdMicros(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
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
