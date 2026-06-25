import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelRatesRepository } from "./model_rates.repository.ts";

type GenerationModelRateRecord = Awaited<
  ReturnType<ModelRatesRepository["listModelRates"]>
>[number];

const mocks = vi.hoisted(() => ({
  rateRows: [] as unknown[],
  pricingPolicyRows: [] as unknown[],
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
  limit: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
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
  generationPricingPolicyTable: {
    id: "generation_pricing_policy.id",
    surchargeBasisPoints: "generation_pricing_policy.surcharge_basis_points",
    createdAt: "generation_pricing_policy.created_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  asc: mocks.asc,
  desc: mocks.desc,
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
    generationPricingPolicy: mocks.generationPricingPolicyTable,
  },
}));

describe("model rates repository", () => {
  beforeEach(() => {
    mocks.rateRows = [];
    mocks.pricingPolicyRows = [];
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
    mocks.limit.mockReset();
    mocks.asc.mockReset();
    mocks.desc.mockReset();
    mocks.eq.mockReset();

    const query = {
      from: mocks.from,
      where: mocks.where,
      orderBy: mocks.orderBy,
      limit: mocks.limit,
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
    mocks.orderBy.mockImplementation(
      (...orderByArgs: { column: unknown; direction: string }[]) => {
        const isModelRateQuery =
          orderByArgs.length === 1 &&
          orderByArgs[0]?.column === "generation_model_rate.id";

        if (isModelRateQuery) {
          return mocks.rateRows;
        }

        return query;
      },
    );
    mocks.limit.mockImplementation(async () => mocks.pricingPolicyRows);
    mocks.asc.mockImplementation((column: unknown) => ({
      column,
      direction: "asc",
    }));
    mocks.desc.mockImplementation((column: unknown) => ({
      column,
      direction: "desc",
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

  it("loads the latest generation pricing policy deterministically", async () => {
    const repository = new ModelRatesRepository();
    const policy = createPricingPolicy();
    mocks.pricingPolicyRows = [policy];

    await expect(
      repository.getCurrentGenerationPricingPolicy(),
    ).resolves.toEqual(policy);

    expect(mocks.select).toHaveBeenCalledWith();
    expect(mocks.from).toHaveBeenCalledWith(mocks.generationPricingPolicyTable);
    expect(mocks.desc).toHaveBeenCalledWith(
      "generation_pricing_policy.created_at",
    );
    expect(mocks.desc).toHaveBeenCalledWith("generation_pricing_policy.id");
    expect(mocks.orderBy).toHaveBeenCalledWith(
      {
        column: "generation_pricing_policy.created_at",
        direction: "desc",
      },
      {
        column: "generation_pricing_policy.id",
        direction: "desc",
      },
    );
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when no generation pricing policy exists", async () => {
    const repository = new ModelRatesRepository();

    await expect(
      repository.getCurrentGenerationPricingPolicy(),
    ).resolves.toBeNull();
  });

  it("creates generation job cost rows", async () => {
    const repository = new ModelRatesRepository();

    await expect(
      repository.createGenerationJobCostWithEstimate({
        jobId: "job_1",
        estimatedCostUsdMicros: 462000,
        currencyCode: "USD",
        estimatedCostSnapshot: createEstimatedCostSnapshot(),
      }),
    ).resolves.toEqual({
      id: "estimate_1",
    });

    expect(mocks.insert).toHaveBeenCalledWith(mocks.generationJobCostTable);
    expect(mocks.insertValues).toHaveBeenCalledWith({
      id: expect.any(String),
      jobId: "job_1",
      estimatedCostUsdMicros: 462000,
      currencyCode: "USD",
      estimatedCostSnapshot: createEstimatedCostSnapshot(),
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

function createPricingPolicy() {
  return {
    id: "global-generation-surcharge-2026-06-25",
    surchargeBasisPoints: 1000,
    createdAt: new Date("2026-06-25T00:00:00.000Z"),
  };
}

function createEstimatedCostSnapshot() {
  return {
    schemaVersion: 1 as const,
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
    baseCostUsdMicros: 420000,
    surcharge: {
      pricingPolicyId: "global-generation-surcharge-2026-06-25",
      surchargeBasisPoints: 1000,
      surchargeUsdMicros: 42000,
    },
    estimatedCostUsdMicros: 462000,
  };
}
