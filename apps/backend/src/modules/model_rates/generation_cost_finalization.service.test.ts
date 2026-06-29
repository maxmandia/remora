import { describe, expect, it, vi } from "vitest";

const moduleMocks = vi.hoisted(() => ({
  modelRatesRepository: {
    getGenerationJobCostByJobId: vi.fn(),
    finalizeGenerationJobCost: vi.fn(),
    setGenerationJobProviderCost: vi.fn(),
  },
}));

vi.mock("./model_rates.repository.ts", () => ({
  modelRatesRepository: moduleMocks.modelRatesRepository,
}));

import type { RetrieveSeedanceVideoTaskResult } from "../generation/generation.types.ts";
import type { TransactionManager } from "../../db/transaction-manager.ts";
import { GenerationCostFinalizationService } from "./generation_cost_finalization.service.ts";
import {
  GenerationJobFinalCostCalculationError,
  type GenerationJobEstimatedCostSnapshot,
} from "./model_rates.types.ts";

describe("generation cost finalization service", () => {
  it("finalizes BytePlus customer charge and provider cost", async () => {
    const finalizedCostRow = createCostRow({
      finalCostUsdMicros: 950612,
      finalCostBasis: "provider_usage",
      finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
    });
    const providerCostedRow = createCostRow({
      ...finalizedCostRow,
      providerCostUsdMicros: 864192,
      providerCostSnapshot: createProviderCostSnapshot(),
    });
    const repository = createRepository({
      finalizedCostRow,
      providerCostedRow,
    });
    const { service, transactionManager } = createService(repository);

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          usage: {
            completionTokens: 123456,
            totalTokens: 123456,
          },
        }),
      }),
    ).resolves.toEqual(providerCostedRow);

    expect(transactionManager.transaction).toHaveBeenCalledTimes(1);
    expect(repository.getGenerationJobCostByJobId).toHaveBeenCalledWith(
      "job_1",
    );
    expect(repository.finalizeGenerationJobCost).toHaveBeenCalledWith({
      jobId: "job_1",
      finalCostUsdMicros: 950612,
      finalCostBasis: "provider_usage",
    });
    expect(repository.setGenerationJobProviderCost).toHaveBeenCalledWith({
      jobId: "job_1",
      providerCostUsdMicros: 864192,
      providerCostSnapshot: createProviderCostSnapshot(),
    });
  });

  it("returns already-finalized generation job costs when all values match", async () => {
    const costRow = createCostRow({
      finalCostUsdMicros: 950612,
      finalCostBasis: "provider_usage",
      finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
      providerCostUsdMicros: 864192,
      providerCostSnapshot: createProviderCostSnapshot(),
    });
    const repository = createRepository({ costRow });
    const { service } = createService(repository);

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          usage: {
            completionTokens: 123456,
            totalTokens: 123456,
          },
        }),
      }),
    ).resolves.toEqual(costRow);

    expect(repository.finalizeGenerationJobCost).not.toHaveBeenCalled();
    expect(repository.setGenerationJobProviderCost).not.toHaveBeenCalled();
  });

  it("rejects already-finalized generation job costs when values conflict", async () => {
    const costRow = createCostRow({
      finalCostUsdMicros: 831600,
      finalCostBasis: "pricing_formula",
      finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
    });
    const repository = createRepository({ costRow });
    const { service } = createService(repository);

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          usage: {
            completionTokens: 123456,
            totalTokens: 123456,
          },
        }),
      }),
    ).rejects.toThrow(GenerationJobFinalCostCalculationError);

    expect(repository.finalizeGenerationJobCost).not.toHaveBeenCalled();
    expect(repository.setGenerationJobProviderCost).not.toHaveBeenCalled();
  });

  it("rejects when BytePlus usage is missing", async () => {
    const repository = createRepository();
    const { service } = createService(repository);

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          usage: null,
        }),
      }),
    ).rejects.toThrow(GenerationJobFinalCostCalculationError);

    expect(repository.finalizeGenerationJobCost).not.toHaveBeenCalled();
    expect(repository.setGenerationJobProviderCost).not.toHaveBeenCalled();
  });

  it("rejects when the generation job cost row is missing", async () => {
    const repository = createRepository({
      costRow: null,
    });
    const { service } = createService(repository);

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          usage: {
            completionTokens: 123456,
            totalTokens: 123456,
          },
        }),
      }),
    ).rejects.toThrow(GenerationJobFinalCostCalculationError);

    expect(repository.finalizeGenerationJobCost).not.toHaveBeenCalled();
    expect(repository.setGenerationJobProviderCost).not.toHaveBeenCalled();
  });

  it("fills provider cost for matching customer-finalized generation job costs", async () => {
    const costRow = createCostRow({
      finalCostUsdMicros: 950612,
      finalCostBasis: "provider_usage",
      finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
    });
    const providerCostedRow = createCostRow({
      ...costRow,
      providerCostUsdMicros: 864192,
      providerCostSnapshot: createProviderCostSnapshot(),
    });
    const repository = createRepository({
      costRow,
      providerCostedRow,
    });
    const { service } = createService(repository);

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          usage: {
            completionTokens: 123456,
            totalTokens: 123456,
          },
        }),
      }),
    ).resolves.toEqual(providerCostedRow);

    expect(repository.finalizeGenerationJobCost).not.toHaveBeenCalled();
    expect(repository.setGenerationJobProviderCost).toHaveBeenCalledWith({
      jobId: "job_1",
      providerCostUsdMicros: 864192,
      providerCostSnapshot: createProviderCostSnapshot(),
    });
  });

  it("rejects already-accrued provider costs when values conflict", async () => {
    const costRow = createCostRow({
      finalCostUsdMicros: 950612,
      finalCostBasis: "provider_usage",
      finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
      providerCostUsdMicros: 1,
      providerCostSnapshot: createProviderCostSnapshot({
        amountUsdMicros: 1,
      }),
    });
    const repository = createRepository({ costRow });
    const { service } = createService(repository);

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          usage: {
            completionTokens: 123456,
            totalTokens: 123456,
          },
        }),
      }),
    ).rejects.toThrow(GenerationJobFinalCostCalculationError);

    expect(repository.finalizeGenerationJobCost).not.toHaveBeenCalled();
    expect(repository.setGenerationJobProviderCost).not.toHaveBeenCalled();
  });

  it("rejects finalization for non-succeeded provider callbacks", async () => {
    const repository = createRepository();
    const { service } = createService(repository);

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          status: "failed",
        }),
      }),
    ).rejects.toThrow(GenerationJobFinalCostCalculationError);

    expect(repository.finalizeGenerationJobCost).not.toHaveBeenCalled();
    expect(repository.setGenerationJobProviderCost).not.toHaveBeenCalled();
  });
});

function createService(repository: ReturnType<typeof createRepository>) {
  const transactionManager = createTransactionManager(repository);
  const service = new GenerationCostFinalizationService({
    transactionManager,
  });

  return { service, transactionManager };
}

function createTransactionManager(repository: ReturnType<typeof createRepository>) {
  return {
    transaction: vi.fn(
      async (callback: (tx: TransactionManager) => Promise<unknown>) =>
        callback({
          modelRates: repository,
        } as unknown as TransactionManager),
    ),
  } as unknown as TransactionManager;
}

function createRepository({
  costRow = createCostRow(),
  finalizedCostRow = createCostRow({
    finalCostUsdMicros: 950612,
    finalCostBasis: "provider_usage",
    finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
  }),
  providerCostedRow = createCostRow({
    finalCostUsdMicros: 950612,
    finalCostBasis: "provider_usage",
    finalizedAt: new Date("2026-06-05T00:01:00.000Z"),
    providerCostUsdMicros: 864192,
    providerCostSnapshot: createProviderCostSnapshot(),
  }),
}: {
  costRow?: ReturnType<typeof createCostRow> | null;
  finalizedCostRow?: ReturnType<typeof createCostRow>;
  providerCostedRow?: ReturnType<typeof createCostRow>;
} = {}) {
  return {
    getGenerationJobCostByJobId: vi.fn(async () => costRow),
    finalizeGenerationJobCost: vi.fn(async () => finalizedCostRow),
    setGenerationJobProviderCost: vi.fn(async () => providerCostedRow),
  };
}

function createCostRow(
  overrides: Partial<{
    finalCostUsdMicros: number | null;
    finalCostBasis: "provider_usage" | "pricing_formula" | null;
    finalizedAt: Date | null;
    providerCostUsdMicros: number | null;
    providerCostSnapshot: ReturnType<typeof createProviderCostSnapshot> | null;
  }> = {},
) {
  return {
    id: "cost_1",
    jobId: "job_1",
    estimatedCostUsdMicros: 831600,
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

function createProviderCostSnapshot(
  overrides: Partial<ReturnType<typeof createProviderCostSnapshotBase>> = {},
) {
  return {
    ...createProviderCostSnapshotBase(),
    ...overrides,
  };
}

function createProviderCostSnapshotBase() {
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

function createEstimatedCostSnapshot(): GenerationJobEstimatedCostSnapshot {
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
    lineItems: [
      {
        rateId: "seedance-720p-input-video-off",
        component: "provider_video_tokens",
        quantitySource: "seedance_estimated_video_tokens",
        finalQuantitySource: "provider_completion_tokens",
        quantity: 108000,
        quantityUnit: "token",
        unitQuantity: 1000000,
        unitPriceUsdMicros: 7000000,
        estimatedCostUsdMicros: 756000,
      },
    ],
    baseCostUsdMicros: 756000,
    surcharge: {
      pricingPolicyId: "global-generation-surcharge-2026-06-25",
      surchargeBasisPoints: 1000,
      surchargeUsdMicros: 75600,
    },
    estimatedCostUsdMicros: 831600,
  };
}

function createProviderCallback(
  overrides: Partial<RetrieveSeedanceVideoTaskResult> = {},
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
      content: {
        video_url: result.videoUrl,
      },
    },
    receivedAt: "2026-06-05T00:00:00.000Z",
  };
}
