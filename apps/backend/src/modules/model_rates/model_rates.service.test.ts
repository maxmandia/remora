import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelRatesRepository } from "./model_rates.repository.ts";
import { ModelRatesService } from "./model_rates.service.ts";
import {
  GenerationModelRatesNotFoundError,
  type EstimateGenerationCostInput,
} from "./model_rates.types.ts";

type GenerationModelRateRecord = Awaited<
  ReturnType<ModelRatesRepository["listModelRates"]>
>[number];

const mocks = vi.hoisted(() => ({
  listModelRates: vi.fn(),
}));

vi.mock("./model_rates.repository.ts", () => ({
  modelRatesRepository: {
    listModelRates: mocks.listModelRates,
  },
}));

describe("model rates service", () => {
  beforeEach(() => {
    mocks.listModelRates.mockReset();
    mocks.listModelRates.mockResolvedValue([createRate()]);
  });

  it("returns a generation cost estimate after loading rates for the model", async () => {
    const service = new ModelRatesService();
    const input = createInput();

    await expect(service.estimateGenerationCost(input)).resolves.toEqual({
      estimatedCostUsdMicros: 420000,
      currencyCode: "USD",
    });

    expect(mocks.listModelRates).toHaveBeenCalledWith("seedance-2.0-video");
  });

  it("does not require a model spec id to load rates", async () => {
    const service = new ModelRatesService();
    const input = createInput({ modelSpecId: undefined });

    await expect(service.estimateGenerationCost(input)).resolves.toEqual({
      estimatedCostUsdMicros: 420000,
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
      service.estimateGenerationCost(
        createInput({
          requestedGenerations: 2,
          attachmentMedia: {
            images: [{ role: "firstFrame" }, { role: "lastFrame" }],
          },
        }),
      ),
    ).resolves.toEqual({
      estimatedCostUsdMicros: 844000,
      currencyCode: "USD",
    });
  });

  it("throws when no rates exist for the model", async () => {
    const service = new ModelRatesService();
    mocks.listModelRates.mockResolvedValue([]);

    await expect(
      service.estimateGenerationCost(createInput()),
    ).rejects.toBeInstanceOf(GenerationModelRatesNotFoundError);
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
