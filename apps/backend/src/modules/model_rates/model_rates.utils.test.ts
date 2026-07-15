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

const seedanceDimensionCases = [
  ["480p", "16:9", 864, 496],
  ["480p", "4:3", 752, 560],
  ["480p", "1:1", 640, 640],
  ["480p", "3:4", 560, 752],
  ["480p", "9:16", 496, 864],
  ["480p", "21:9", 992, 432],
  ["720p", "16:9", 1280, 720],
  ["720p", "4:3", 1112, 834],
  ["720p", "1:1", 960, 960],
  ["720p", "3:4", 834, 1112],
  ["720p", "9:16", 720, 1280],
  ["720p", "21:9", 1470, 630],
  ["1080p", "16:9", 1920, 1080],
  ["1080p", "4:3", 1664, 1248],
  ["1080p", "1:1", 1440, 1440],
  ["1080p", "3:4", 1248, 1664],
  ["1080p", "9:16", 1080, 1920],
  ["1080p", "21:9", 2206, 946],
  ["4k", "16:9", 3840, 2160],
  ["4k", "4:3", 3326, 2494],
  ["4k", "1:1", 2880, 2880],
  ["4k", "3:4", 2494, 3326],
  ["4k", "9:16", 2160, 3840],
  ["4k", "21:9", 4398, 1886],
] as const;

describe("model rates utils", () => {
  it("creates a Kling output video line item from matching seconds-based rates", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          modelId: "kling-v3-text-to-video",
          modelSpecId: "kling-v3-text-to-video-v1",
          resolution: "720p",
          duration: 5,
          generateAudio: false,
        }),
      ),
      rates: [
        createRate({
          id: "kling-720p-audio-off",
          modelSpecId: "kling-v3-text-to-video-v1",
          unitPriceUsdMicros: 84000,
          conditions: {
            outputResolution: "720p",
            nativeAudio: false,
          },
        }),
        createRate({
          id: "kling-1080p-audio-off",
          modelSpecId: "kling-v3-text-to-video-v1",
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
          modelSpecId: "kling-v3-text-to-video-v1",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
        }),
      ),
      rates: [
        createRate({
          id: "kling-720p-audio-on",
          modelSpecId: "kling-v3-text-to-video-v1",
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

  it.each(seedanceDimensionCases)(
    "uses documented Seedance dimensions for %s %s",
    (resolution, aspectRatio, widthPx, heightPx) => {
      const lineItems = buildGenerationCostLineItems({
        jobFacts: buildJobFactsForLineItems(
          createInput({
            resolution,
            aspectRatio,
            duration: 5,
          }),
        ),
        rates: [createSeedanceRate({ conditions: {} })],
      });

      expect(lineItems[0]?.quantity).toBe((5 * widthPx * heightPx * 24) / 1024);
    },
  );

  it("matches the documented 720p square estimate with surcharge", () => {
    const estimate = buildGenerationJobCostEstimate({
      input: createInput({
        resolution: "720p",
        aspectRatio: "1:1",
        duration: 5,
      }),
      pricingPolicy: createPricingPolicy(),
      rates: [createSeedanceRate()],
    });

    expect(estimate).toMatchObject({
      estimatedCostUsdMicros: 831600,
      estimatedCostSnapshot: {
        schemaVersion: 2,
        baseCostUsdMicros: 756000,
        lineItems: [{ quantity: 108000 }],
      },
    });
  });

  it("creates Seedance token line items for video input", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          attachmentMedia: {
            videos: [{ role: "reference", durationSec: 2 }],
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
        quantity: 194400,
        estimatedCostUsdMicros: 835920,
      },
    ]);
  });

  it("sums reference video durations before applying the minimum", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          duration: 5,
          attachmentMedia: {
            videos: [
              { role: "reference", durationSec: 2.25 },
              { role: "reference", durationSec: 2.75 },
            ],
          },
        }),
      ),
      rates: [
        createSeedanceRate({
          id: "seedance-720p-input-video-on",
          unitPriceUsdMicros: 4300000,
          conditions: { inputIncludesVideo: true },
        }),
      ],
    });

    expect(lineItems).toMatchObject([
      {
        quantity: 216000,
        estimatedCostUsdMicros: 928800,
      },
    ]);
  });

  it("uses the maximum reference duration when duration metadata is missing", () => {
    const jobFacts = buildJobFactsForLineItems(
      createInput({
        attachmentMedia: {
          videos: [{ role: "reference" }],
        },
      }),
    );
    const lineItems = buildGenerationCostLineItems({
      jobFacts,
      rates: [
        createSeedanceRate({
          unitPriceUsdMicros: 4300000,
          conditions: { inputIncludesVideo: true },
        }),
      ],
    });

    expect(jobFacts.inputVideoDurationSeconds).toBe(15);
    expect(lineItems[0]?.quantity).toBe(432000);
  });

  it("applies the Seedance Fast video-input rate to the corrected quantity", () => {
    const lineItems = buildGenerationCostLineItems({
      jobFacts: buildJobFactsForLineItems(
        createInput({
          modelId: "seedance-2.0-fast-video",
          modelSpecId: "seedance-2.0-fast-video-v1",
          attachmentMedia: {
            videos: [{ role: "reference", durationSec: 2 }],
          },
        }),
      ),
      rates: [
        createSeedanceRate({
          id: "seedance-fast-input-video-on",
          modelSpecId: "seedance-2.0-fast-video-v1",
          unitPriceUsdMicros: 3300000,
          conditions: { inputIncludesVideo: true },
        }),
      ],
    });

    expect(lineItems).toMatchObject([
      {
        quantity: 194400,
        estimatedCostUsdMicros: 641520,
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

  it("uses the largest documented dimensions for adaptive aspect ratio", () => {
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
        quantity: 108680.625,
        estimatedCostUsdMicros: 760765,
      },
    ]);
  });

  it.each([
    { resolution: "1440p", aspectRatio: "16:9" },
    { resolution: "720p", aspectRatio: "2:1" },
  ])(
    "rejects unsupported Seedance dimensions: $resolution $aspectRatio",
    ({ resolution, aspectRatio }) => {
      expect(() =>
        buildGenerationCostLineItems({
          jobFacts: buildJobFactsForLineItems(
            createInput({ resolution, aspectRatio }),
          ),
          rates: [createSeedanceRate({ conditions: {} })],
        }),
      ).toThrow(GenerationModelRateConfigurationError);
    },
  );

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
          inputVideoDurationSeconds: 0,
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

  it("fails cost estimation when no pricing line matches", () => {
    expect(() =>
      buildGenerationJobCostEstimate({
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
      }),
    ).toThrow(GenerationModelRateConfigurationError);
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
    modelSpecId: "seedance-2.0-video-v1",
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
    modelSpecId: "model_1-v1",
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
