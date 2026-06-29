import { describe, expect, it } from "vitest";

import {
  calculateGenerationJobFinalCostFromProviderUsage,
  calculateGenerationJobProviderCostFromProviderUsage,
} from "./generation_cost_finalization.utils.ts";
import {
  GenerationJobFinalCostCalculationError,
  type GenerationCostLineItem,
  type GenerationJobEstimatedCostSnapshot,
} from "./model_rates.types.ts";

describe("generation cost finalization utils", () => {
  it("calculates final provider completion token costs rounded up", () => {
    const finalCost = calculateGenerationJobFinalCostFromProviderUsage({
      completionTokens: 10,
      estimatedCostSnapshot: createEstimatedCostSnapshot({
        lineItems: [
          createProviderCompletionTokenLineItem({
            unitQuantity: 3,
            unitPriceUsdMicros: 100,
          }),
        ],
        surcharge: {
          pricingPolicyId: "global-generation-surcharge-2026-06-25",
          surchargeBasisPoints: 0,
          surchargeUsdMicros: 0,
        },
      }),
    });

    expect(finalCost).toEqual({
      finalCostUsdMicros: 334,
      finalCostBasis: "provider_usage",
    });
  });

  it("recalculates surcharge from the final provider usage base cost", () => {
    const finalCost = calculateGenerationJobFinalCostFromProviderUsage({
      completionTokens: 10,
      estimatedCostSnapshot: createEstimatedCostSnapshot({
        lineItems: [
          createProviderCompletionTokenLineItem({
            unitQuantity: 3,
            unitPriceUsdMicros: 100,
          }),
        ],
        surcharge: {
          pricingPolicyId: "global-generation-surcharge-2026-06-25",
          surchargeBasisPoints: 1000,
          surchargeUsdMicros: 999999,
        },
      }),
    });

    expect(finalCost).toEqual({
      finalCostUsdMicros: 368,
      finalCostBasis: "provider_usage",
    });
  });

  it("throws when provider completion token line items are missing", () => {
    expect(() =>
      calculateGenerationJobFinalCostFromProviderUsage({
        completionTokens: 10,
        estimatedCostSnapshot: createEstimatedCostSnapshot({
          lineItems: [
            createProviderCompletionTokenLineItem({
              finalQuantitySource: null,
            }),
          ],
        }),
      }),
    ).toThrow(GenerationJobFinalCostCalculationError);
  });

  it("throws when multiple provider completion token line items exist", () => {
    expect(() =>
      calculateGenerationJobFinalCostFromProviderUsage({
        completionTokens: 10,
        estimatedCostSnapshot: createEstimatedCostSnapshot({
          lineItems: [
            createProviderCompletionTokenLineItem({
              rateId: "seedance-720p-input-video-off",
            }),
            createProviderCompletionTokenLineItem({
              rateId: "seedance-720p-input-video-overlap",
            }),
          ],
        }),
      }),
    ).toThrow(GenerationJobFinalCostCalculationError);
  });

  it.each([null, undefined, -1, Number.NaN, Infinity])(
    "throws when provider completion tokens are invalid: %s",
    (completionTokens) => {
      expect(() =>
        calculateGenerationJobFinalCostFromProviderUsage({
          completionTokens,
          estimatedCostSnapshot: createEstimatedCostSnapshot(),
        }),
      ).toThrow(GenerationJobFinalCostCalculationError);
    },
  );

  it("calculates provider cost without the customer surcharge", () => {
    const providerCost = calculateGenerationJobProviderCostFromProviderUsage({
      completionTokens: 10,
      totalTokens: 12,
      providerModelId: "dreamina-seedance-2-0-260128",
      providerTaskId: "cgt-123",
      estimatedCostSnapshot: createEstimatedCostSnapshot({
        lineItems: [
          createProviderCompletionTokenLineItem({
            unitQuantity: 3,
            unitPriceUsdMicros: 100,
          }),
        ],
        surcharge: {
          pricingPolicyId: "global-generation-surcharge-2026-06-25",
          surchargeBasisPoints: 1000,
          surchargeUsdMicros: 999999,
        },
      }),
    });

    expect(providerCost).toEqual({
      providerCostUsdMicros: 334,
      providerCostSnapshot: {
        schemaVersion: 1,
        source: "provider_usage",
        provider: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
        usage: {
          completionTokens: 10,
          totalTokens: 12,
        },
        lineItem: {
          rateId: "seedance-720p-input-video-off",
          component: "provider_video_tokens",
          finalQuantitySource: "provider_completion_tokens",
          quantityUnit: "token",
          unitQuantity: 3,
          unitPriceUsdMicros: 100,
          amountUsdMicros: 334,
        },
        amountUsdMicros: 334,
      },
    });
  });

  it("throws when provider cost completion tokens are invalid", () => {
    expect(() =>
      calculateGenerationJobProviderCostFromProviderUsage({
        completionTokens: Number.NaN,
        totalTokens: 12,
        providerModelId: "dreamina-seedance-2-0-260128",
        providerTaskId: "cgt-123",
        estimatedCostSnapshot: createEstimatedCostSnapshot(),
      }),
    ).toThrow(GenerationJobFinalCostCalculationError);
  });

  it("throws when provider cost total tokens are invalid", () => {
    expect(() =>
      calculateGenerationJobProviderCostFromProviderUsage({
        completionTokens: 10,
        totalTokens: Infinity,
        providerModelId: "dreamina-seedance-2-0-260128",
        providerTaskId: "cgt-123",
        estimatedCostSnapshot: createEstimatedCostSnapshot(),
      }),
    ).toThrow(GenerationJobFinalCostCalculationError);
  });
});

function createEstimatedCostSnapshot(
  overrides: Partial<GenerationJobEstimatedCostSnapshot> = {},
): GenerationJobEstimatedCostSnapshot {
  return {
    schemaVersion: 1,
    jobFacts: {
      outputResolution: "720p",
      outputAspectRatio: "16:9",
      outputDurationSeconds: 5,
      nativeAudio: true,
      voiceControl: false,
      inputIncludesVideo: false,
      inputImageCount: 0,
      requestedGenerations: 1,
    },
    lineItems: [createProviderCompletionTokenLineItem()],
    baseCostUsdMicros: 756000,
    surcharge: {
      pricingPolicyId: "global-generation-surcharge-2026-06-25",
      surchargeBasisPoints: 1000,
      surchargeUsdMicros: 75600,
    },
    estimatedCostUsdMicros: 831600,
    ...overrides,
  };
}

function createProviderCompletionTokenLineItem(
  overrides: Partial<GenerationCostLineItem> = {},
): GenerationCostLineItem {
  return {
    rateId: "seedance-720p-input-video-off",
    component: "provider_video_tokens",
    quantitySource: "seedance_estimated_video_tokens",
    finalQuantitySource: "provider_completion_tokens",
    quantity: 108000,
    quantityUnit: "token",
    unitQuantity: 1000000,
    unitPriceUsdMicros: 7000000,
    estimatedCostUsdMicros: 756000,
    ...overrides,
  };
}
