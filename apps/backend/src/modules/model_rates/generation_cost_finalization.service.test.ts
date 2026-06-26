import { describe, expect, it, vi } from "vitest";

const moduleMocks = vi.hoisted(() => ({
  modelRatesRepository: {
    getGenerationJobCostByJobId: vi.fn(),
    finalizeGenerationJobCost: vi.fn(),
  },
}));

vi.mock("./model_rates.repository.ts", () => ({
  modelRatesRepository: moduleMocks.modelRatesRepository,
}));

import type { RetrieveSeedanceVideoTaskResult } from "../generation/generation.types.ts";
import { GenerationCostFinalizationService } from "./generation_cost_finalization.service.ts";
import type { ModelRatesRepository } from "./model_rates.repository.ts";
import {
  GenerationJobFinalCostCalculationError,
  type GenerationJobEstimatedCostSnapshot,
} from "./model_rates.types.ts";

describe("generation cost finalization service", () => {
  it("finalizes BytePlus generation job costs", async () => {
    const repository = createRepository();
    const service = new GenerationCostFinalizationService(
      repository as unknown as ModelRatesRepository,
    );

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
    ).resolves.toBeUndefined();

    expect(repository.getGenerationJobCostByJobId).toHaveBeenCalledWith(
      "job_1",
    );
    expect(repository.finalizeGenerationJobCost).toHaveBeenCalledWith({
      jobId: "job_1",
      finalCostUsdMicros: 950612,
      finalCostBasis: "provider_usage",
    });
  });

  it("rejects when BytePlus usage is missing", async () => {
    const repository = createRepository();
    const service = new GenerationCostFinalizationService(
      repository as unknown as ModelRatesRepository,
    );

    await expect(
      service.finalizeGenerationJobCost({
        jobId: "job_1",
        callback: createProviderCallback({
          usage: null,
        }),
      }),
    ).rejects.toThrow(GenerationJobFinalCostCalculationError);

    expect(repository.finalizeGenerationJobCost).not.toHaveBeenCalled();
  });

  it("rejects when the generation job cost row is missing", async () => {
    const repository = createRepository({
      costRow: null,
    });
    const service = new GenerationCostFinalizationService(
      repository as unknown as ModelRatesRepository,
    );

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
  });
});

function createRepository({
  costRow = createCostRow(),
}: {
  costRow?: ReturnType<typeof createCostRow> | null;
} = {}) {
  return {
    getGenerationJobCostByJobId: vi.fn(async () => costRow),
    finalizeGenerationJobCost: vi.fn(async () => costRow ?? createCostRow()),
  };
}

function createCostRow() {
  return {
    id: "cost_1",
    jobId: "job_1",
    estimatedCostUsdMicros: 831600,
    currencyCode: "USD",
    estimatedCostSnapshot: createEstimatedCostSnapshot(),
    finalCostUsdMicros: null,
    finalCostBasis: null,
    finalizedAt: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
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
