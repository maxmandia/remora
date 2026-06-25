import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelRatesRepository } from "./model_rates.repository.ts";

type GenerationModelRateRecord = Awaited<
  ReturnType<ModelRatesRepository["listModelRates"]>
>[number];

const mocks = vi.hoisted(() => ({
  rateRows: [] as unknown[],
  costRow: {
    id: "estimate_1",
  } as unknown,
  select: vi.fn(),
  insert: vi.fn(),
  insertValues: vi.fn(),
  returning: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  asc: vi.fn(),
  eq: vi.fn(),
  generationModelRateTable: {
    id: "generation_model_rate.id",
    modelId: "generation_model_rate.model_id",
    component: "generation_model_rate.component",
    quantitySource: "generation_model_rate.quantity_source",
    finalQuantitySource: "generation_model_rate.final_quantity_source",
    quantityUnit: "generation_model_rate.quantity_unit",
    unitQuantity: "generation_model_rate.unit_quantity",
    unitPriceUsdMicros: "generation_model_rate.unit_price_usd_micros",
    conditions: "generation_model_rate.conditions",
  },
  generationJobCostTable: {
    id: "generation_job_cost.id",
    jobId: "generation_job_cost.job_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  asc: mocks.asc,
  eq: mocks.eq,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
  },
  schema: {
    generationModelRate: mocks.generationModelRateTable,
    generationJobCost: mocks.generationJobCostTable,
  },
}));

describe("model rates repository", () => {
  beforeEach(() => {
    mocks.rateRows = [];
    mocks.costRow = {
      id: "estimate_1",
    };
    mocks.select.mockReset();
    mocks.insert.mockReset();
    mocks.insertValues.mockReset();
    mocks.returning.mockReset();
    mocks.from.mockReset();
    mocks.where.mockReset();
    mocks.orderBy.mockReset();
    mocks.asc.mockReset();
    mocks.eq.mockReset();

    const query = {
      from: mocks.from,
      where: mocks.where,
      orderBy: mocks.orderBy,
    };

    mocks.select.mockReturnValue(query);
    mocks.insert.mockReturnValue({
      values: mocks.insertValues,
    });
    mocks.insertValues.mockReturnValue({
      returning: mocks.returning,
    });
    mocks.returning.mockImplementation(async () => [mocks.costRow]);
    mocks.from.mockReturnValue(query);
    mocks.where.mockReturnValue(query);
    mocks.orderBy.mockImplementation(async () => mocks.rateRows);
    mocks.asc.mockImplementation((column: unknown) => ({
      column,
      direction: "asc",
    }));
    mocks.eq.mockImplementation((left: unknown, right: unknown) => ({
      left,
      operator: "eq",
      right,
    }));
  });

  it("queries rates by model id", async () => {
    const repository = new ModelRatesRepository();
    const rate = createRate();
    mocks.rateRows = [rate];

    await expect(repository.listModelRates("model_1")).resolves.toEqual([rate]);

    expect(mocks.select).toHaveBeenCalledWith();
    expect(mocks.from).toHaveBeenCalledWith(mocks.generationModelRateTable);
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_model_rate.model_id",
      "model_1",
    );
  });

  it("returns an empty array when no rows exist", async () => {
    const repository = new ModelRatesRepository();

    await expect(repository.listModelRates("model_1")).resolves.toEqual([]);
  });

  it("orders rates deterministically by id", async () => {
    const repository = new ModelRatesRepository();

    await repository.listModelRates("model_1");

    expect(mocks.asc).toHaveBeenCalledWith("generation_model_rate.id");
    expect(mocks.orderBy).toHaveBeenCalledWith({
      column: "generation_model_rate.id",
      direction: "asc",
    });
  });

  it("creates generation job cost rows", async () => {
    const repository = new ModelRatesRepository();

    await expect(
      repository.createGenerationJobCostWithEstimate({
        jobId: "job_1",
        estimatedCostUsdMicros: 420000,
        currencyCode: "USD",
        estimatedCostSnapshot: {
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
          lineItems: [],
        },
      }),
    ).resolves.toEqual({
      id: "estimate_1",
    });

    expect(mocks.insert).toHaveBeenCalledWith(mocks.generationJobCostTable);
    expect(mocks.insertValues).toHaveBeenCalledWith({
      id: expect.any(String),
      jobId: "job_1",
      estimatedCostUsdMicros: 420000,
      currencyCode: "USD",
      estimatedCostSnapshot: {
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
        lineItems: [],
      },
    });
  });
});

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
