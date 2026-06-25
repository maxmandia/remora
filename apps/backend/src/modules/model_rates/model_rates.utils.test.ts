import { describe, expect, it } from "vitest";

import {
  buildGenerationCostLineItems,
  buildGenerationJobCostEstimate,
  buildJobFactsForLineItems,
} from "./model_rates.utils.ts";
import {
  GenerationModelRateConfigurationError,
  type EstimateGenerationCostInput,
  type GenerationModelRateConditions,
} from "./model_rates.types.ts";
import type { generationModelRate } from "./schema/table.ts";

type GenerationModelRateRecord = typeof generationModelRate.$inferSelect;

describe("model rates utils", () => {
  it("creates a Kling output video line item from matching seconds-based rates", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          modelId: "kling-v3-text-to-video",
          resolution: "720p",
          duration: 5,
          generateAudio: false,
        }),
      ),
      rates: [
        createRate({
          id: "kling-720p-audio-off",
          modelId: "kling-v3-text-to-video",
          unitPriceUsdMicros: 84000,
          conditions: {
            outputResolution: "720p",
            nativeAudio: false,
          },
        }),
        createRate({
          id: "kling-1080p-audio-off",
          modelId: "kling-v3-text-to-video",
          unitPriceUsdMicros: 112000,
          conditions: {
            outputResolution: "1080p",
            nativeAudio: false,
          },
        }),
      ],
    });

    expect(lineItems).toMatchObject([
      {
        rateId: "kling-720p-audio-off",
        quantitySource: "output_duration_seconds",
        quantity: 5,
        estimatedCostUsdMicros: 420000,
      },
    ]);
  });

  it("matches Kling native audio rates", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          modelId: "kling-v3-text-to-video",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
        }),
      ),
      rates: [
        createRate({
          id: "kling-720p-audio-on",
          modelId: "kling-v3-text-to-video",
          unitPriceUsdMicros: 126000,
          conditions: {
            outputResolution: "720p",
            nativeAudio: true,
            voiceControl: false,
          },
        }),
      ],
    });

    expect(lineItems).toMatchObject([
      {
        rateId: "kling-720p-audio-on",
        quantity: 5,
        estimatedCostUsdMicros: 630000,
      },
    ]);
  });

  it("creates Seedance token line items for text and image input", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          attachmentMedia: {
            images: [{ role: "firstFrame" }],
          },
        }),
      ),
      rates: [
        createSeedanceRate({
          id: "seedance-720p-input-video-off",
          unitPriceUsdMicros: 7000000,
          conditions: {
            outputResolution: ["480p", "720p"],
            inputIncludesVideo: false,
          },
        }),
        createSeedanceRate({
          id: "seedance-720p-input-video-on",
          unitPriceUsdMicros: 4300000,
          conditions: {
            outputResolution: ["480p", "720p"],
            inputIncludesVideo: true,
          },
        }),
      ],
    });

    expect(lineItems).toMatchObject([
      {
        rateId: "seedance-720p-input-video-off",
        quantitySource: "seedance_estimated_video_tokens",
        quantity: 108000,
        estimatedCostUsdMicros: 756000,
      },
    ]);
  });

  it("creates Seedance token line items for video input", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          attachmentMedia: {
            videos: [{ role: "reference" }],
          },
        }),
      ),
      rates: [
        createSeedanceRate({
          id: "seedance-720p-input-video-off",
          unitPriceUsdMicros: 7000000,
          conditions: {
            outputResolution: ["480p", "720p"],
            inputIncludesVideo: false,
          },
        }),
        createSeedanceRate({
          id: "seedance-720p-input-video-on",
          unitPriceUsdMicros: 4300000,
          conditions: {
            outputResolution: ["480p", "720p"],
            inputIncludesVideo: true,
          },
        }),
      ],
    });

    expect(lineItems).toMatchObject([
      {
        rateId: "seedance-720p-input-video-on",
        quantity: 108000,
        estimatedCostUsdMicros: 464400,
      },
    ]);
  });

  it("multiplies line item quantities by requested generations", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          duration: 5,
          requestedGenerations: 2,
        }),
      ),
      rates: [createRate({ unitPriceUsdMicros: 84000 })],
    });

    expect(lineItems).toMatchObject([
      {
        quantity: 10,
        estimatedCostUsdMicros: 840000,
      },
    ]);
  });

  it("returns no line items for nonmatching conditions", () => {
    expect(
      buildGenerationCostLineItems({
        jobFacts: buildJobFactsForLineItems(
          createInput({
            resolution: "1080p",
          }),
        ),
        rates: [
          createRate({
            conditions: {
              outputResolution: "720p",
            },
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("throws when rate conditions contain unknown keys", () => {
    expect(() =>
      buildGenerationCostLineItems({
        jobFacts: buildJobFactsForLineItems(createInput()),
        rates: [
          createRate({
            conditions: {
              unknownCondition: true,
            } as unknown as GenerationModelRateConditions,
          }),
        ],
      }),
    ).toThrow(GenerationModelRateConfigurationError);
  });

  it("uses the default estimate duration for adaptive Seedance duration", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          resolution: "720p",
          aspectRatio: "16:9",
          duration: -1,
        }),
      ),
      rates: [createSeedanceRate()],
    });

    expect(lineItems).toMatchObject([
      {
        quantity: 108000,
        estimatedCostUsdMicros: 756000,
      },
    ]);
  });

  it("uses a 16:9 estimate for adaptive Seedance aspect ratio", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          resolution: "720p",
          aspectRatio: "adaptive",
          duration: 5,
        }),
      ),
      rates: [createSeedanceRate()],
    });

    expect(lineItems).toMatchObject([
      {
        quantity: 108000,
        estimatedCostUsdMicros: 756000,
      },
    ]);
  });

  it("rounds line item costs up to avoid undercharging fractional units", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          duration: 10,
        }),
      ),
      rates: [
        createRate({
          unitQuantity: 3,
          unitPriceUsdMicros: 100,
        }),
      ],
    });

    expect(lineItems).toMatchObject([
      {
        quantity: 10,
        estimatedCostUsdMicros: 334,
      },
    ]);
  });

  it("builds a v2 job cost snapshot with base cost and surcharge details", () => {
    const estimate = buildGenerationJobCostEstimate({
      input: createInput({
        duration: 5,
      }),
      pricingPolicy: createPricingPolicy(),
      rates: [createRate({ unitPriceUsdMicros: 84000 })],
    });

    expect(estimate).toEqual({
      estimatedCostUsdMicros: 462000,
      currencyCode: "USD",
      estimatedCostSnapshot: {
        schemaVersion: 2,
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
        lineItems: [
          expect.objectContaining({
            estimatedCostUsdMicros: 420000,
            quantity: 5,
            rateId: "rate_1",
          }),
        ],
        baseCostUsdMicros: 420000,
        surcharge: {
          pricingPolicyId: "global-generation-surcharge-2026-06-25",
          surchargeBasisPoints: 1000,
          surchargeUsdMicros: 42000,
        },
        estimatedCostUsdMicros: 462000,
      },
    });
  });

  it("rounds surcharge costs up to avoid undercharging fractional micros", () => {
    const estimate = buildGenerationJobCostEstimate({
      input: createInput({
        duration: 10,
      }),
      pricingPolicy: createPricingPolicy(),
      rates: [
        createRate({
          unitQuantity: 3,
          unitPriceUsdMicros: 100,
        }),
      ],
    });

    expect(estimate.estimatedCostUsdMicros).toBe(368);
    expect(estimate.estimatedCostSnapshot).toMatchObject({
      schemaVersion: 2,
      baseCostUsdMicros: 334,
      surcharge: {
        surchargeUsdMicros: 34,
      },
      estimatedCostUsdMicros: 368,
    });
  });

  it("keeps zero-cost estimates at zero surcharge", () => {
    const estimate = buildGenerationJobCostEstimate({
      input: createInput({
        resolution: "1080p",
      }),
      pricingPolicy: createPricingPolicy(),
      rates: [
        createRate({
          conditions: {
            outputResolution: "720p",
          },
        }),
      ],
    });

    expect(estimate).toMatchObject({
      estimatedCostUsdMicros: 0,
      estimatedCostSnapshot: {
        schemaVersion: 2,
        lineItems: [],
        baseCostUsdMicros: 0,
        surcharge: {
          surchargeUsdMicros: 0,
        },
        estimatedCostUsdMicros: 0,
      },
    });
  });
});

function createInput(
  overrides: Partial<EstimateGenerationCostInput> = {},
): EstimateGenerationCostInput {
  return {
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    resolution: "720p",
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
    ...overrides,
  };
}

function createSeedanceRate(
  overrides: Partial<GenerationModelRateRecord> = {},
) {
  return createRate({
    id: "seedance-720p-input-video-off",
    modelId: "seedance-2.0-video",
    component: "provider_video_tokens",
    quantitySource: "seedance_estimated_video_tokens",
    finalQuantitySource: "provider_completion_tokens",
    quantityUnit: "token",
    unitQuantity: 1000000,
    unitPriceUsdMicros: 7000000,
    conditions: {
      outputResolution: ["480p", "720p"],
      inputIncludesVideo: false,
    },
    ...overrides,
  });
}

function createRate(
  overrides: Partial<GenerationModelRateRecord> = {},
): GenerationModelRateRecord {
  return {
    id: "rate_1",
    modelId: "model_1",
    component: "output_video",
    quantitySource: "output_duration_seconds",
    finalQuantitySource: null,
    quantityUnit: "second",
    unitQuantity: 1,
    unitPriceUsdMicros: 84000,
    conditions: {},
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createPricingPolicy() {
  return {
    id: "global-generation-surcharge-2026-06-25",
    surchargeBasisPoints: 1000,
  };
}
