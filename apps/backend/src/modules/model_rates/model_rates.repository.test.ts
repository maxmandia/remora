import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelRatesRepository } from "./model_rates.repository.ts";

type GenerationModelRateRecord = Awaited<
  ReturnType<ModelRatesRepository["listModelRates"]>
>[number];

const mocks = vi.hoisted(() => ({
  rateRows: [] as unknown[],
  pricingPolicyRows: [] as unknown[],
  costRows: [] as unknown[],
  costRow: {
    id: "estimate_1",
  } as unknown,
  selectedTable: undefined as unknown,
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  insertValues: vi.fn(),
  returning: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  updateReturning: vi.fn(),
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
    finalCostUsdMicros: "generation_job_cost.final_cost_usd_micros",
    finalCostBasis: "generation_job_cost.final_cost_basis",
    finalizedAt: "generation_job_cost.finalized_at",
    providerCostUsdMicros: "generation_job_cost.provider_cost_usd_micros",
    providerCostSnapshot: "generation_job_cost.provider_cost_snapshot",
    updatedAt: "generation_job_cost.updated_at",
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
    update: mocks.update,
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
    mocks.costRows = [];
    mocks.costRow = {
      id: "estimate_1",
    };
    mocks.selectedTable = undefined;
    mocks.select.mockReset();
    mocks.insert.mockReset();
    mocks.update.mockReset();
    mocks.insertValues.mockReset();
    mocks.returning.mockReset();
    mocks.updateSet.mockReset();
    mocks.updateWhere.mockReset();
    mocks.updateReturning.mockReset();
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
    mocks.update.mockReturnValue({
      set: mocks.updateSet,
    });
    mocks.insertValues.mockReturnValue({
      returning: mocks.returning,
    });
    mocks.updateSet.mockReturnValue({
      where: mocks.updateWhere,
    });
    mocks.updateWhere.mockReturnValue({
      returning: mocks.updateReturning,
    });
    mocks.returning.mockImplementation(async () => [mocks.costRow]);
    mocks.updateReturning.mockImplementation(async () => [mocks.costRow]);
    mocks.from.mockImplementation((table: unknown) => {
      mocks.selectedTable = table;
      return query;
    });
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
    mocks.limit.mockImplementation(async () => {
      if (mocks.selectedTable === mocks.generationJobCostTable) {
        return mocks.costRows;
      }

      return mocks.pricingPolicyRows;
    });
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

  it("loads generation job cost rows by job id", async () => {
    const repository = new ModelRatesRepository();
    const costRow = createCostRow();
    mocks.costRows = [costRow];

    await expect(
      repository.getGenerationJobCostByJobId("job_1"),
    ).resolves.toEqual(costRow);

    expect(mocks.select).toHaveBeenCalledWith();
    expect(mocks.from).toHaveBeenCalledWith(mocks.generationJobCostTable);
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_job_cost.job_id",
      "job_1",
    );
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when a generation job cost row does not exist", async () => {
    const repository = new ModelRatesRepository();

    await expect(
      repository.getGenerationJobCostByJobId("job_1"),
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

  it("finalizes generation job cost rows", async () => {
    const repository = new ModelRatesRepository();
    const finalizedCostRow = createCostRow({
      finalCostUsdMicros: 950612,
      finalCostBasis: "provider_usage",
      finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
    });
    mocks.costRow = finalizedCostRow;

    await expect(
      repository.finalizeGenerationJobCost({
        jobId: "job_1",
        finalCostUsdMicros: 950612,
        finalCostBasis: "provider_usage",
      }),
    ).resolves.toEqual(finalizedCostRow);

    expect(mocks.update).toHaveBeenCalledWith(mocks.generationJobCostTable);
    expect(mocks.updateSet).toHaveBeenCalledWith({
      finalCostUsdMicros: 950612,
      finalCostBasis: "provider_usage",
      finalizedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_job_cost.job_id",
      "job_1",
    );
  });

  it("throws when generation job cost finalization does not update a row", async () => {
    const repository = new ModelRatesRepository();
    mocks.updateReturning.mockResolvedValue([]);

    await expect(
      repository.finalizeGenerationJobCost({
        jobId: "job_1",
        finalCostUsdMicros: 950612,
        finalCostBasis: "provider_usage",
      }),
    ).rejects.toThrow("Generation job cost was not finalized for job job_1");
  });

  it("sets generation job provider cost fields", async () => {
    const repository = new ModelRatesRepository();
    const costRow = createCostRow({
      providerCostUsdMicros: 864192,
      providerCostSnapshot: createProviderCostSnapshot(),
    });
    mocks.costRow = costRow;

    await expect(
      repository.setGenerationJobProviderCost({
        jobId: "job_1",
        providerCostUsdMicros: 864192,
        providerCostSnapshot: createProviderCostSnapshot(),
      }),
    ).resolves.toEqual(costRow);

    expect(mocks.update).toHaveBeenCalledWith(mocks.generationJobCostTable);
    expect(mocks.updateSet).toHaveBeenCalledWith({
      providerCostUsdMicros: 864192,
      providerCostSnapshot: createProviderCostSnapshot(),
      updatedAt: expect.any(Date),
    });
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_job_cost.job_id",
      "job_1",
    );
  });

  it("throws when setting generation job provider cost does not update a row", async () => {
    const repository = new ModelRatesRepository();
    mocks.updateReturning.mockResolvedValue([]);

    await expect(
      repository.setGenerationJobProviderCost({
        jobId: "job_1",
        providerCostUsdMicros: 864192,
        providerCostSnapshot: createProviderCostSnapshot(),
      }),
    ).rejects.toThrow("Generation job provider cost was not set for job job_1");
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

function createCostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "estimate_1",
    jobId: "job_1",
    estimatedCostUsdMicros: 462000,
    currencyCode: "USD",
    estimatedCostSnapshot: createEstimatedCostSnapshot(),
    finalCostUsdMicros: null,
    finalCostBasis: null,
    finalizedAt: null,
    providerCostUsdMicros: null,
    providerCostSnapshot: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createProviderCostSnapshot() {
  return {
    schemaVersion: 1 as const,
    source: "provider_usage" as const,
    provider: "byteplus" as const,
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    usage: {
      completionTokens: 123456,
      totalTokens: 123456,
    },
    lineItem: {
      rateId: "seedance-720p-input-video-off",
      component: "provider_video_tokens" as const,
      finalQuantitySource: "provider_completion_tokens" as const,
      quantityUnit: "token" as const,
      unitQuantity: 1000000,
      unitPriceUsdMicros: 7000000,
      amountUsdMicros: 864192,
    },
    amountUsdMicros: 864192,
  };
}
