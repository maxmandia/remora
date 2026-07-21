import {
  GenerationJobFinalCostCalculationError,
  type GenerationCostLineItem,
  type GenerationJobEstimatedCostSnapshot,
  type GenerationJobFinalCost,
  type GenerationJobProviderCost,
  type GoogleGenerationJobProviderCostSnapshot,
} from "./model_rates.types.ts";
import { calculateSurchargeUsdMicros } from "./model_rates.utils.ts";

type GoogleProviderUsage = {
  inputTokens?: number | null;
  outputTextTokens?: number | null;
  outputImageTokens?: number | null;
  thoughtTokens?: number | null;
  totalTokens?: number | null;
};

type GoogleOutputImageResolution = "512" | "1K" | "2K" | "4K";

type GoogleGenerationPricing = {
  providerTokenUnitQuantity: number;
  inputTokenUnitPriceUsdMicros: number;
  outputTextAndThoughtTokenUnitPriceUsdMicros: number;
  outputImageTokenUnitPriceUsdMicros: number;
  outputImageFallbackUsdMicrosByResolution: Record<
    GoogleOutputImageResolution,
    number
  >;
};

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

export function calculateGoogleGenerationJobProviderCost({
  estimatedCostSnapshot,
  providerModelId,
  providerTaskId,
  usage,
}: {
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot;
  providerModelId: string | null;
  providerTaskId: string;
  usage: GoogleProviderUsage | null | undefined;
}): GenerationJobProviderCost {
  const googlePricing = {
    providerTokenUnitQuantity: 1_000_000,
    inputTokenUnitPriceUsdMicros: 500_000,
    outputTextAndThoughtTokenUnitPriceUsdMicros: 3_000_000,
    outputImageTokenUnitPriceUsdMicros: 60_000_000,
    outputImageFallbackUsdMicrosByResolution: {
      "512": 45_000,
      "1K": 67_000,
      "2K": 101_000,
      "4K": 151_000,
    },
  } satisfies GoogleGenerationPricing;

  const outputResolution = getGoogleOutputResolution(
    estimatedCostSnapshot,
    googlePricing,
  );
  const normalizedUsage: GoogleGenerationJobProviderCostSnapshot["usage"] = {
    inputTokens: normalizeGoogleTokenCount(usage?.inputTokens),
    outputTextTokens: normalizeGoogleTokenCount(usage?.outputTextTokens),
    outputImageTokens: normalizeGoogleTokenCount(usage?.outputImageTokens),
    thoughtTokens: normalizeGoogleTokenCount(usage?.thoughtTokens),
    totalTokens: normalizeGoogleTokenCount(usage?.totalTokens),
  };
  const completeUsage = getCompleteGoogleProviderUsage(normalizedUsage);

  const lineItems: GoogleGenerationJobProviderCostSnapshot["lineItems"] =
    completeUsage
      ? createGoogleUsageLineItems({
          usage: completeUsage,
          pricing: googlePricing,
        })
      : [
          createGoogleOutputImageFallbackLineItem({
            outputResolution,
            pricing: googlePricing,
          }),
        ];
  const providerCostUsdMicros = lineItems.reduce(
    (sum, lineItem) => sum + lineItem.amountUsdMicros,
    0,
  );

  if (!isValidUsdMicros(providerCostUsdMicros)) {
    throw new GenerationJobFinalCostCalculationError(
      "Google generation job provider cost exceeds the supported range",
    );
  }

  return {
    providerCostUsdMicros,
    providerCostSnapshot: {
      schemaVersion: 1,
      source: "provider_usage",
      provider: "google",
      providerTaskId,
      providerModelId,
      outputResolution,
      incompleteUsage: !completeUsage,
      usage: normalizedUsage,
      lineItems,
      amountUsdMicros: providerCostUsdMicros,
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
      estimatedCostSnapshot.schemaVersion !== 2 &&
      estimatedCostSnapshot.schemaVersion !== 3)
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

function getGoogleOutputResolution(
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot,
  pricing: GoogleGenerationPricing,
): GoogleOutputImageResolution {
  const outputResolution = estimatedCostSnapshot.jobFacts.outputResolution;

  if (outputResolution in pricing.outputImageFallbackUsdMicrosByResolution) {
    return outputResolution as GoogleOutputImageResolution;
  }

  throw new GenerationJobFinalCostCalculationError(
    `Google generation job output resolution cannot be costed: ${outputResolution}`,
  );
}

function normalizeGoogleTokenCount(value: number | null | undefined) {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
}

function getCompleteGoogleProviderUsage(
  usage: GoogleGenerationJobProviderCostSnapshot["usage"],
) {
  if (
    usage.inputTokens === null ||
    usage.outputTextTokens === null ||
    usage.outputImageTokens === null ||
    usage.thoughtTokens === null
  ) {
    return null;
  }

  return {
    inputTokens: usage.inputTokens,
    outputTextTokens: usage.outputTextTokens,
    outputImageTokens: usage.outputImageTokens,
    thoughtTokens: usage.thoughtTokens,
  };
}

function createGoogleUsageLineItems({
  pricing,
  usage,
}: {
  pricing: GoogleGenerationPricing;
  usage: {
    inputTokens: number;
    outputImageTokens: number;
    outputTextTokens: number;
    thoughtTokens: number;
  };
}): GoogleGenerationJobProviderCostSnapshot["lineItems"] {
  const { inputTokens, outputImageTokens, outputTextTokens, thoughtTokens } =
    usage;
  const outputTextAndThoughtTokens = outputTextTokens + thoughtTokens;

  if (!Number.isSafeInteger(outputTextAndThoughtTokens)) {
    throw new GenerationJobFinalCostCalculationError(
      "Google generation job text and thought token usage exceeds the supported range",
    );
  }

  return [
    createGoogleTokenLineItem({
      kind: "input_tokens",
      quantity: inputTokens,
      pricing,
      unitPriceUsdMicros: pricing.inputTokenUnitPriceUsdMicros,
    }),
    createGoogleTokenLineItem({
      kind: "output_text_and_thought_tokens",
      quantity: outputTextAndThoughtTokens,
      pricing,
      unitPriceUsdMicros: pricing.outputTextAndThoughtTokenUnitPriceUsdMicros,
    }),
    createGoogleTokenLineItem({
      kind: "output_image_tokens",
      quantity: outputImageTokens,
      pricing,
      unitPriceUsdMicros: pricing.outputImageTokenUnitPriceUsdMicros,
    }),
  ];
}

function createGoogleTokenLineItem({
  kind,
  pricing,
  quantity,
  unitPriceUsdMicros,
}: {
  kind: Extract<
    GoogleGenerationJobProviderCostSnapshot["lineItems"][number]["kind"],
    "input_tokens" | "output_text_and_thought_tokens" | "output_image_tokens"
  >;
  pricing: GoogleGenerationPricing;
  quantity: number;
  unitPriceUsdMicros: number;
}): GoogleGenerationJobProviderCostSnapshot["lineItems"][number] {
  return {
    kind,
    quantity,
    unitQuantity: pricing.providerTokenUnitQuantity,
    unitPriceUsdMicros,
    amountUsdMicros: Math.ceil(
      (quantity * unitPriceUsdMicros) / pricing.providerTokenUnitQuantity,
    ),
  };
}

function createGoogleOutputImageFallbackLineItem({
  outputResolution,
  pricing,
}: {
  outputResolution: GoogleOutputImageResolution;
  pricing: GoogleGenerationPricing;
}): GoogleGenerationJobProviderCostSnapshot["lineItems"][number] {
  const unitPriceUsdMicros =
    pricing.outputImageFallbackUsdMicrosByResolution[outputResolution];

  return {
    kind: "output_image_fallback",
    quantity: 1,
    unitQuantity: 1,
    unitPriceUsdMicros,
    amountUsdMicros: unitPriceUsdMicros,
  };
}
