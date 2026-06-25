import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelRatesRepository } from "./model_rates.repository.ts";
import { ModelRatesService } from "./model_rates.service.ts";
import {
  GenerationModelRatesNotFoundError,
  GenerationPricingPolicyNotFoundError,
  type EstimateGenerationCostInput,
} from "./model_rates.types.ts";

type GenerationModelRateRecord = Awaited<
  ReturnType<ModelRatesRepository["listModelRates"]>
>[number];

const mocks = vi.hoisted(() => ({
  getCurrentGenerationPricingPolicy: vi.fn(),
  listModelRates: vi.fn(),
}));

vi.mock("./model_rates.repository.ts", () => ({
  modelRatesRepository: {
    getCurrentGenerationPricingPolicy: mocks.getCurrentGenerationPricingPolicy,
    listModelRates: mocks.listModelRates,
  },
}));

describe("model rates service", () => {
  beforeEach(() => {
    mocks.getCurrentGenerationPricingPolicy.mockReset();
    mocks.getCurrentGenerationPricingPolicy.mockResolvedValue(
      createPricingPolicy(),
    );
    mocks.listModelRates.mockReset();
    mocks.listModelRates.mockResolvedValue([createRate()]);
  });

  it("returns a generation cost estimate after loading rates for the model", async () => {
    const service = new ModelRatesService();
    const input = createInput();

    await expect(
      service.estimateGenerationCostForAllJobs(input),
    ).resolves.toEqual({
      estimatedCostUsdMicros: 462000,
      currencyCode: "USD",
    });

    expect(mocks.listModelRates).toHaveBeenCalledWith("seedance-2.0-video");
    expect(mocks.getCurrentGenerationPricingPolicy).toHaveBeenCalledWith();
  });

  it("returns a generation job cost with a durable estimated cost snapshot", async () => {
    const service = new ModelRatesService();

    await expect(
      service.estimateGenerationCostForSingleJob(createInput()),
    ).resolves.toEqual({
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
            rateId: "rate_1",
            quantity: 5,
            estimatedCostUsdMicros: 420000,
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

  it("does not require a model spec id to load rates", async () => {
    const service = new ModelRatesService();
    const input = createInput({ modelSpecId: undefined });

    await expect(
      service.estimateGenerationCostForAllJobs(input),
    ).resolves.toEqual({
      estimatedCostUsdMicros: 462000,
      currencyCode: "USD",
    });

    expect(mocks.listModelRates).toHaveBeenCalledWith("seedance-2.0-video");
  });

  it("sums matching line item costs", async () => {
    const service = new ModelRatesService();
    mocks.listModelRates.mockResolvedValue([
      createRate(),
      createRate({
        id: "rate_2",
        component: "input_image",
        quantitySource: "input_image_count",
        quantityUnit: "image",
        unitPriceUsdMicros: 1000,
      }),
    ]);

    await expect(
      service.estimateGenerationCostForAllJobs(
        createInput({
          requestedGenerations: 2,
          attachmentMedia: {
            images: [{ role: "firstFrame" }, { role: "lastFrame" }],
          },
        }),
      ),
    ).resolves.toEqual({
      estimatedCostUsdMicros: 928400,
      currencyCode: "USD",
    });
  });

  it("matches public multi-generation estimates to summed per-job reservations", async () => {
    const service = new ModelRatesService();
    mocks.listModelRates.mockResolvedValue([
      createRate({
        unitQuantity: 3,
        unitPriceUsdMicros: 100,
      }),
    ]);

    await expect(
      service.estimateGenerationCostForAllJobs(
        createInput({
          duration: 10,
          requestedGenerations: 2,
        }),
      ),
    ).resolves.toEqual({
      estimatedCostUsdMicros: 736,
      currencyCode: "USD",
    });
  });

  it("throws when no generation pricing policy exists", async () => {
    const service = new ModelRatesService();
    mocks.getCurrentGenerationPricingPolicy.mockResolvedValue(null);

    await expect(
      service.estimateGenerationCostForAllJobs(createInput()),
    ).rejects.toBeInstanceOf(GenerationPricingPolicyNotFoundError);
  });

  it("throws when no rates exist for the model", async () => {
    const service = new ModelRatesService();
    mocks.listModelRates.mockResolvedValue([]);

    await expect(
      service.estimateGenerationCostForAllJobs(createInput()),
    ).rejects.toBeInstanceOf(GenerationModelRatesNotFoundError);
    expect(mocks.getCurrentGenerationPricingPolicy).not.toHaveBeenCalled();
  });
});

function createInput(
  overrides: Partial<EstimateGenerationCostInput> = {},
): EstimateGenerationCostInput {
  const input: EstimateGenerationCostInput = {
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    resolution: "720p",
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
    ...overrides,
  };

  if ("modelSpecId" in overrides && overrides.modelSpecId === undefined) {
    delete input.modelSpecId;
  }

  return input;
}

function createRate(
  overrides: Partial<GenerationModelRateRecord> = {},
): GenerationModelRateRecord {
  return {
    id: "rate_1",
    modelId: "seedance-2.0-video",
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
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
  };
}
