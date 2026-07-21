import { describe, expect, it } from "vitest";

import {
  calculateGenerationJobFinalCostFromPricingFormula,
  calculateGenerationJobFinalCostFromProviderUsage,
  calculateGenerationJobProviderCostFromProviderUsage,
  calculateGoogleGenerationJobProviderCost,
  calculateKlingGenerationJobProviderCostFromPricingFormula,
} from "./generation_cost_finalization.utils.ts";
import {
  GenerationJobFinalCostCalculationError,
  type GenerationCostLineItem,
  type GenerationJobEstimatedCostSnapshot,
  type GenerationJobEstimatedCostSnapshotV1,
  type GenerationJobPricingFormulaProviderCostLineItem,
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

  it("finalizes pricing formula customer cost with the estimated surcharge", () => {
    const finalCost = calculateGenerationJobFinalCostFromPricingFormula({
      estimatedCostSnapshot: createPricingFormulaEstimatedCostSnapshot(),
    });

    expect(finalCost).toEqual({
      finalCostUsdMicros: 616000,
      finalCostBasis: "pricing_formula",
    });
  });

  it("finalizes v2 pricing formula snapshots while retaining v1 support", () => {
    const v1Snapshot = createPricingFormulaEstimatedCostSnapshot();
    const v2Snapshot: GenerationJobEstimatedCostSnapshot = {
      ...v1Snapshot,
      schemaVersion: 2,
      jobFacts: {
        ...v1Snapshot.jobFacts,
        inputVideoDurationSeconds: 0,
      },
    };

    expect(
      calculateGenerationJobFinalCostFromPricingFormula({
        estimatedCostSnapshot: v2Snapshot,
      }),
    ).toEqual({
      finalCostUsdMicros: 616000,
      finalCostBasis: "pricing_formula",
    });
  });

  it("accrues pricing formula provider cost without the customer surcharge", () => {
    const estimatedCostSnapshot = createPricingFormulaEstimatedCostSnapshot();
    const providerCost =
      calculateKlingGenerationJobProviderCostFromPricingFormula({
        providerModelId: "kling-v3",
        providerTaskId: "kling-task-123",
        estimatedCostSnapshot,
      });

    expect(providerCost).toEqual({
      providerCostUsdMicros: 560000,
      providerCostSnapshot: {
        schemaVersion: 1,
        source: "pricing_formula",
        provider: "kling",
        providerTaskId: "kling-task-123",
        providerModelId: "kling-v3",
        lineItems: [createFinalizedPricingFormulaLineItem()],
        amountUsdMicros: 560000,
      },
    });
  });

  it("accrues Google provider cost from complete token usage", () => {
    const providerCost = calculateGoogleGenerationJobProviderCost({
      providerModelId: "gemini-3.1-flash-image",
      providerTaskId: "interaction-123",
      estimatedCostSnapshot: createGoogleEstimatedCostSnapshot(),
      usage: {
        inputTokens: 1_000,
        outputTextTokens: 100,
        thoughtTokens: 50,
        outputImageTokens: 1_000,
        totalTokens: 2_150,
      },
    });

    expect(providerCost).toEqual({
      providerCostUsdMicros: 60_950,
      providerCostSnapshot: {
        schemaVersion: 1,
        source: "provider_usage",
        provider: "google",
        providerTaskId: "interaction-123",
        providerModelId: "gemini-3.1-flash-image",
        outputResolution: "1K",
        incompleteUsage: false,
        usage: {
          inputTokens: 1_000,
          outputTextTokens: 100,
          thoughtTokens: 50,
          outputImageTokens: 1_000,
          totalTokens: 2_150,
        },
        lineItems: [
          {
            kind: "input_tokens",
            quantity: 1_000,
            unitQuantity: 1_000_000,
            unitPriceUsdMicros: 500_000,
            amountUsdMicros: 500,
          },
          {
            kind: "output_text_and_thought_tokens",
            quantity: 150,
            unitQuantity: 1_000_000,
            unitPriceUsdMicros: 3_000_000,
            amountUsdMicros: 450,
          },
          {
            kind: "output_image_tokens",
            quantity: 1_000,
            unitQuantity: 1_000_000,
            unitPriceUsdMicros: 60_000_000,
            amountUsdMicros: 60_000,
          },
        ],
        amountUsdMicros: 60_950,
      },
    });
  });

  it.each([
    { resolution: "512", amountUsdMicros: 45_000 },
    { resolution: "1K", amountUsdMicros: 67_000 },
    { resolution: "2K", amountUsdMicros: 101_000 },
    { resolution: "4K", amountUsdMicros: 151_000 },
  ] as const)(
    "uses the $resolution Google output fallback when usage is absent",
    ({ amountUsdMicros, resolution }) => {
      const providerCost = calculateGoogleGenerationJobProviderCost({
        providerModelId: "gemini-3.1-flash-image",
        providerTaskId: "interaction-123",
        estimatedCostSnapshot: createGoogleEstimatedCostSnapshot({
          outputResolution: resolution,
        }),
        usage: null,
      });

      expect(providerCost).toEqual({
        providerCostUsdMicros: amountUsdMicros,
        providerCostSnapshot: expect.objectContaining({
          provider: "google",
          outputResolution: resolution,
          incompleteUsage: true,
          usage: {
            inputTokens: null,
            outputTextTokens: null,
            outputImageTokens: null,
            thoughtTokens: null,
            totalTokens: null,
          },
          lineItems: [
            {
              kind: "output_image_fallback",
              quantity: 1,
              unitQuantity: 1,
              unitPriceUsdMicros: amountUsdMicros,
              amountUsdMicros,
            },
          ],
          amountUsdMicros,
        }),
      });
    },
  );

  it("uses the Google fallback and records partial usage as incomplete", () => {
    const providerCost = calculateGoogleGenerationJobProviderCost({
      providerModelId: "gemini-3.1-flash-image",
      providerTaskId: "interaction-123",
      estimatedCostSnapshot: createGoogleEstimatedCostSnapshot({
        outputResolution: "2K",
      }),
      usage: {
        inputTokens: 250,
        outputTextTokens: null,
        outputImageTokens: 1_680,
        thoughtTokens: 0,
        totalTokens: 1_930,
      },
    });

    expect(providerCost.providerCostUsdMicros).toBe(101_000);
    expect(providerCost.providerCostSnapshot).toMatchObject({
      provider: "google",
      incompleteUsage: true,
      usage: {
        inputTokens: 250,
        outputTextTokens: null,
        outputImageTokens: 1_680,
        thoughtTokens: 0,
        totalTokens: 1_930,
      },
      lineItems: [{ kind: "output_image_fallback" }],
    });
  });

  it.each([
    {
      name: "missing line items",
      mutate: (snapshot: GenerationJobEstimatedCostSnapshot) => {
        snapshot.lineItems = [];
      },
    },
    {
      name: "malformed line items",
      mutate: (snapshot: GenerationJobEstimatedCostSnapshot) => {
        snapshot.lineItems = [null as unknown as GenerationCostLineItem];
      },
    },
    {
      name: "provider-finalized line items",
      mutate: (snapshot: GenerationJobEstimatedCostSnapshot) => {
        snapshot.lineItems[0]!.finalQuantitySource =
          "provider_completion_tokens";
      },
    },
    {
      name: "inconsistent line item amounts",
      mutate: (snapshot: GenerationJobEstimatedCostSnapshot) => {
        snapshot.lineItems[0]!.estimatedCostUsdMicros = 1;
      },
    },
    {
      name: "inconsistent base cost",
      mutate: (snapshot: GenerationJobEstimatedCostSnapshot) => {
        snapshot.baseCostUsdMicros = 1;
      },
    },
    {
      name: "inconsistent surcharge",
      mutate: (snapshot: GenerationJobEstimatedCostSnapshot) => {
        snapshot.surcharge.surchargeUsdMicros = 1;
      },
    },
    {
      name: "missing surcharge",
      mutate: (snapshot: GenerationJobEstimatedCostSnapshot) => {
        snapshot.surcharge =
          null as unknown as GenerationJobEstimatedCostSnapshot["surcharge"];
      },
    },
    {
      name: "inconsistent estimated cost",
      mutate: (snapshot: GenerationJobEstimatedCostSnapshot) => {
        snapshot.estimatedCostUsdMicros = 1;
      },
    },
  ])("rejects pricing formula snapshots with $name", ({ mutate }) => {
    const estimatedCostSnapshot = createPricingFormulaEstimatedCostSnapshot();
    mutate(estimatedCostSnapshot);

    expect(() =>
      calculateGenerationJobFinalCostFromPricingFormula({
        estimatedCostSnapshot,
      }),
    ).toThrow(GenerationJobFinalCostCalculationError);
  });
});

function createEstimatedCostSnapshot(
  overrides: Partial<GenerationJobEstimatedCostSnapshotV1> = {},
): GenerationJobEstimatedCostSnapshotV1 {
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

function createPricingFormulaEstimatedCostSnapshot(): GenerationJobEstimatedCostSnapshotV1 {
  return {
    schemaVersion: 1,
    jobFacts: {
      outputResolution: "1080p",
      outputAspectRatio: "16:9",
      outputDurationSeconds: 5,
      nativeAudio: false,
      voiceControl: false,
      inputIncludesVideo: false,
      inputImageCount: 0,
      requestedGenerations: 1,
    },
    lineItems: [createPricingFormulaLineItem()],
    baseCostUsdMicros: 560000,
    surcharge: {
      pricingPolicyId: "global-generation-surcharge-2026-06-25",
      surchargeBasisPoints: 1000,
      surchargeUsdMicros: 56000,
    },
    estimatedCostUsdMicros: 616000,
  };
}

function createGoogleEstimatedCostSnapshot({
  outputResolution = "1K",
}: {
  outputResolution?: "512" | "1K" | "2K" | "4K";
} = {}): GenerationJobEstimatedCostSnapshot {
  return {
    schemaVersion: 3,
    jobFacts: {
      modelType: "image",
      outputResolution,
      outputAspectRatio: "1:1",
      inputImageCount: 0,
      requestedGenerations: 1,
    },
    lineItems: [
      {
        rateId: `nano-banana-2-${outputResolution}`,
        component: "output_image",
        quantitySource: "output_image_count",
        finalQuantitySource: null,
        quantity: 1,
        quantityUnit: "image",
        unitQuantity: 1,
        unitPriceUsdMicros: 67_000,
        estimatedCostUsdMicros: 67_000,
      },
    ],
    baseCostUsdMicros: 67_000,
    surcharge: {
      pricingPolicyId: "global-generation-surcharge-2026-06-25",
      surchargeBasisPoints: 1000,
      surchargeUsdMicros: 6_700,
    },
    estimatedCostUsdMicros: 73_700,
  };
}

function createPricingFormulaLineItem(): GenerationCostLineItem {
  return {
    rateId: "kling-1080p-audio-off",
    component: "output_video",
    quantitySource: "output_duration_seconds",
    finalQuantitySource: null,
    quantity: 5,
    quantityUnit: "second",
    unitQuantity: 1,
    unitPriceUsdMicros: 112000,
    estimatedCostUsdMicros: 560000,
  };
}

function createFinalizedPricingFormulaLineItem(): GenerationJobPricingFormulaProviderCostLineItem {
  const { estimatedCostUsdMicros, ...lineItem } =
    createPricingFormulaLineItem();

  return {
    ...lineItem,
    finalQuantitySource: null,
    amountUsdMicros: estimatedCostUsdMicros,
  };
}
