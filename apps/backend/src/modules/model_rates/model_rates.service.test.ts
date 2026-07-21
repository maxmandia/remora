import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { GenerationProviderTaskResult } from "../generation/generation.types.ts";
import {
  modelRatesRepository,
  type ModelRatesRepository,
} from "./model_rates.repository.ts";
import { ModelRatesService } from "./model_rates.service.ts";
import {
  GenerationJobFinalCostCalculationError,
  GenerationModelRatesNotFoundError,
  GenerationPricingPolicyNotFoundError,
  type EstimateGenerationCostInput,
  type EstimateVideoGenerationCostInput,
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

  it("returns a generation cost estimate after loading rates for the model spec", async () => {
    const service = createModelRatesService();
    const input = createInput();

    await expect(
      service.estimateGenerationCostForAllJobs(input),
    ).resolves.toEqual({
      estimatedCostUsdMicros: 462000,
      currencyCode: "USD",
    });

    expect(mocks.listModelRates).toHaveBeenCalledWith("seedance-2.0-video-v1");
    expect(mocks.getCurrentGenerationPricingPolicy).toHaveBeenCalledWith();
  });

  it("returns a generation job cost with a durable estimated cost snapshot", async () => {
    const service = createModelRatesService();

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
          inputVideoDurationSeconds: 0,
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

  it("pins rate loading to the requested model spec id", async () => {
    const service = createModelRatesService();
    const input = createInput({ modelSpecId: "seedance-2.0-video-v2" });

    await expect(
      service.estimateGenerationCostForAllJobs(input),
    ).resolves.toEqual({
      estimatedCostUsdMicros: 462000,
      currencyCode: "USD",
    });

    expect(mocks.listModelRates).toHaveBeenCalledWith("seedance-2.0-video-v2");
  });

  it("sums matching line item costs", async () => {
    const service = createModelRatesService();
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
    const service = createModelRatesService();
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
    const service = createModelRatesService();
    mocks.getCurrentGenerationPricingPolicy.mockResolvedValue(null);

    await expect(
      service.estimateGenerationCostForAllJobs(createInput()),
    ).rejects.toBeInstanceOf(GenerationPricingPolicyNotFoundError);
  });

  it("throws when no rates exist for the model", async () => {
    const service = createModelRatesService();
    mocks.listModelRates.mockResolvedValue([]);

    await expect(
      service.estimateGenerationCostForAllJobs(createInput()),
    ).rejects.toBeInstanceOf(GenerationModelRatesNotFoundError);
    expect(mocks.getCurrentGenerationPricingPolicy).not.toHaveBeenCalled();
  });

  it("settles generation job costs inside one transaction", async () => {
    const callback = createProviderCallback();
    const finalizedCost = createFinalizedCostRow();
    const finalizeGenerationJobCost = vi.fn().mockResolvedValue(finalizedCost);
    const settleGenerationJobCost = vi.fn().mockResolvedValue(null);
    const transactionHarness = createSettlementTransactionHarness({
      finalizeGenerationJobCost,
      settleGenerationJobCost,
    });
    const service = new ModelRatesService({} as ModelRatesRepository, {
      transactionManager: transactionHarness.transactionManager,
    });

    await expect(
      service.settleGenerationJobCost({
        jobId: "job_1",
        callback,
      }),
    ).resolves.toBeUndefined();

    expect(
      transactionHarness.transactionManager.transaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      transactionHarness.generation.getGenerationJobById,
    ).toHaveBeenCalledWith("job_1");
    expect(finalizeGenerationJobCost).toHaveBeenCalledWith({
      jobId: "job_1",
      callback,
    });
    expect(settleGenerationJobCost).toHaveBeenCalledWith({
      userId: "user_1",
      generationJobId: "job_1",
      generationJobCostId: "cost_1",
      estimatedCostUsdMicros: 831600,
      finalCostUsdMicros: 950612,
    });
  });

  it("does not settle credits when finalization fails", async () => {
    const finalizeGenerationJobCost = vi
      .fn()
      .mockRejectedValue(
        new GenerationJobFinalCostCalculationError("Provider usage missing"),
      );
    const settleGenerationJobCost = vi.fn();
    const transactionHarness = createSettlementTransactionHarness({
      finalizeGenerationJobCost,
      settleGenerationJobCost,
    });
    const service = new ModelRatesService({} as ModelRatesRepository, {
      transactionManager: transactionHarness.transactionManager,
    });

    await expect(
      service.settleGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback(),
      }),
    ).rejects.toThrow(GenerationJobFinalCostCalculationError);

    expect(settleGenerationJobCost).not.toHaveBeenCalled();
  });

  it("rejects settlement when the generation job is missing", async () => {
    const transactionHarness = createSettlementTransactionHarness({
      job: null,
    });
    const service = new ModelRatesService({} as ModelRatesRepository, {
      transactionManager: transactionHarness.transactionManager,
    });

    await expect(
      service.settleGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback(),
      }),
    ).rejects.toThrow(GenerationJobFinalCostCalculationError);
  });
});

function createInput(
  overrides: Partial<EstimateVideoGenerationCostInput> = {},
): EstimateGenerationCostInput {
  const input: EstimateGenerationCostInput = {
    modelType: "video",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    resolution: "720p",
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
    ...overrides,
  };

  return input;
}

function createRate(
  overrides: Partial<GenerationModelRateRecord> = {},
): GenerationModelRateRecord {
  return {
    id: "rate_1",
    modelSpecId: "seedance-2.0-video-v1",
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

function createProviderCallback(
  overrides: Partial<GenerationProviderTaskResult> = {},
) {
  const result = {
    provider: "byteplus" as const,
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    status: "succeeded" as const,
    videoUrl: "https://assets.example/video.mp4",
    usage: {
      completionTokens: 123456,
      totalTokens: 123456,
    },
    createdAt: 1780770000,
    updatedAt: 1780770060,
    providerError: null,
    ...overrides,
  };

  return {
    kind: "result" as const,
    result,
    rawPayload: {
      id: result.providerTaskId,
      status: result.status,
    },
    receivedAt: "2026-06-05T00:00:00.000Z",
  };
}

function createFinalizedCostRow() {
  return {
    id: "cost_1",
    jobId: "job_1",
    estimatedCostUsdMicros: 831600,
    currencyCode: "USD",
    estimatedCostSnapshot: createEstimatedCostSnapshot(),
    finalCostUsdMicros: 950612,
    finalCostBasis: "provider_usage" as const,
    finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
    providerCostUsdMicros: 864192,
    providerCostSnapshot: createProviderCostSnapshot(),
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:01:00.000Z"),
  };
}

function createSettlementTransactionHarness({
  finalizeGenerationJobCost = vi.fn(),
  job = {
    id: "job_1",
    userId: "user_1",
  },
  settleGenerationJobCost = vi.fn(),
}: {
  finalizeGenerationJobCost?: ReturnType<typeof vi.fn>;
  job?: { id: string; userId: string } | null;
  settleGenerationJobCost?: ReturnType<typeof vi.fn>;
} = {}) {
  const generation = {
    getGenerationJobById: vi.fn().mockResolvedValue(job),
  };
  const transaction = {
    generation,
    services: {
      credits: {
        settleGenerationJobCost,
      },
      generationCostFinalization: {
        finalizeGenerationJobCost,
      },
    },
  } as unknown as TransactionManager;
  const transactionManager = {
    transaction: vi.fn(
      async (callback: (tx: TransactionManager) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as TransactionManager;

  return {
    finalizeGenerationJobCost,
    generation,
    settleGenerationJobCost,
    transaction,
    transactionManager,
  };
}

function createModelRatesService(
  repository: ModelRatesRepository = modelRatesRepository,
) {
  return new ModelRatesService(repository, {
    transactionManager: createUnusedTransactionManager(),
  });
}

function createUnusedTransactionManager() {
  return {
    transaction: vi.fn(async () => {
      throw new Error("Unexpected transaction call");
    }),
  } as unknown as TransactionManager;
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
    baseCostUsdMicros: 756000,
    surcharge: {
      pricingPolicyId: "global-generation-surcharge-2026-06-25",
      surchargeBasisPoints: 1000,
      surchargeUsdMicros: 75600,
    },
    estimatedCostUsdMicros: 831600,
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
