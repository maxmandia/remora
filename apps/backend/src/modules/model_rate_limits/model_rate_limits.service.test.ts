import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { ModelRateLimitsRepository } from "./model_rate_limits.repository.ts";
import type { GenerationModelRateLimitRecord } from "./model_rate_limits.types.ts";

const mocks = vi.hoisted(() => ({
  listModelRateLimits: vi.fn(),
  upsertRateLimitConcurrencyLeases: vi.fn(),
  upsertRateLimitWindowEntries: vi.fn(),
  releaseJobConcurrencyLeases: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("./model_rate_limits.repository.ts", () => ({
  ModelRateLimitsRepository: class {},
  modelRateLimitsRepository: {
    listModelRateLimits: mocks.listModelRateLimits,
    upsertRateLimitConcurrencyLeases:
      mocks.upsertRateLimitConcurrencyLeases,
    upsertRateLimitWindowEntries: mocks.upsertRateLimitWindowEntries,
    releaseJobConcurrencyLeases: mocks.releaseJobConcurrencyLeases,
  },
}));

import { ModelRateLimitsService } from "./model_rate_limits.service.ts";

describe("model rate limits service", () => {
  let service: ModelRateLimitsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
    mocks.listModelRateLimits.mockReset();
    mocks.upsertRateLimitConcurrencyLeases.mockReset();
    mocks.upsertRateLimitWindowEntries.mockReset();
    mocks.releaseJobConcurrencyLeases.mockReset();
    mocks.transaction.mockReset();
    mocks.transaction.mockImplementation(
      async (callback: (tx: TransactionManager) => Promise<unknown>) =>
        callback({
          modelRateLimits: createRepository(),
        } as unknown as TransactionManager),
    );
    mocks.listModelRateLimits.mockResolvedValue(createSeedanceRateLimits());
    mocks.upsertRateLimitConcurrencyLeases.mockResolvedValue(undefined);
    mocks.upsertRateLimitWindowEntries.mockResolvedValue(undefined);
    mocks.releaseJobConcurrencyLeases.mockResolvedValue(undefined);
    service = new ModelRateLimitsService({
      transactionManager: {
        transaction: mocks.transaction,
      } as unknown as TransactionManager,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records non-4k Seedance request and concurrency accounting", async () => {
    await service.recordProviderSubmissionStarted({
      jobId: "job_1",
      modelId: "seedance-2.0-video",
      providerId: "byteplus",
      facts: {
        outputResolution: "720p",
      },
    });

    expect(mocks.listModelRateLimits).toHaveBeenCalledWith(
      "seedance-2.0-video",
    );
    expect(mocks.upsertRateLimitWindowEntries).toHaveBeenCalledWith({
      jobId: "job_1",
      occurredAt: new Date("2026-07-07T12:00:00.000Z"),
      bucketIds: ["byteplus-seedance-2.0-video-non-4k-rpm"],
    });
    expect(mocks.upsertRateLimitConcurrencyLeases).toHaveBeenCalledWith({
      jobId: "job_1",
      acquiredAt: new Date("2026-07-07T12:00:00.000Z"),
      expiresAt: new Date("2026-07-08T12:00:00.000Z"),
      bucketIds: [
        "byteplus-seedance-2.0-video-non-4k-concurrent-task",
      ],
    });
  });

  it("records 4k Seedance request and concurrency accounting", async () => {
    await service.recordProviderSubmissionStarted({
      jobId: "job_1",
      modelId: "seedance-2.0-video",
      providerId: "byteplus",
      facts: {
        outputResolution: "4k",
      },
    });

    expect(mocks.upsertRateLimitWindowEntries).toHaveBeenCalledWith({
      jobId: "job_1",
      occurredAt: new Date("2026-07-07T12:00:00.000Z"),
      bucketIds: ["byteplus-seedance-2.0-video-4k-rpm"],
    });
    expect(mocks.upsertRateLimitConcurrencyLeases).toHaveBeenCalledWith({
      jobId: "job_1",
      acquiredAt: new Date("2026-07-07T12:00:00.000Z"),
      expiresAt: new Date("2026-07-08T12:00:00.000Z"),
      bucketIds: ["byteplus-seedance-2.0-video-4k-concurrent-task"],
    });
  });

  it("records empty bucket sets when no rate limits match", async () => {
    mocks.listModelRateLimits.mockResolvedValueOnce([]);

    await service.recordProviderSubmissionStarted({
      jobId: "job_1",
      modelId: "seedance-2.0-video",
      providerId: "byteplus",
      facts: {
        outputResolution: "720p",
      },
    });

    expect(mocks.upsertRateLimitWindowEntries).toHaveBeenCalledWith({
      jobId: "job_1",
      occurredAt: new Date("2026-07-07T12:00:00.000Z"),
      bucketIds: [],
    });
    expect(mocks.upsertRateLimitConcurrencyLeases).toHaveBeenCalledWith({
      jobId: "job_1",
      acquiredAt: new Date("2026-07-07T12:00:00.000Z"),
      expiresAt: new Date("2026-07-08T12:00:00.000Z"),
      bucketIds: [],
    });
  });

  it("ignores rate limits for other providers", async () => {
    await service.recordProviderSubmissionStarted({
      jobId: "job_1",
      modelId: "seedance-2.0-video",
      providerId: "other-provider",
      facts: {
        outputResolution: "720p",
      },
    });

    expect(mocks.upsertRateLimitWindowEntries).toHaveBeenCalledWith({
      jobId: "job_1",
      occurredAt: new Date("2026-07-07T12:00:00.000Z"),
      bucketIds: [],
    });
    expect(mocks.upsertRateLimitConcurrencyLeases).toHaveBeenCalledWith({
      jobId: "job_1",
      acquiredAt: new Date("2026-07-07T12:00:00.000Z"),
      expiresAt: new Date("2026-07-08T12:00:00.000Z"),
      bucketIds: [],
    });
  });

  it("releases job concurrency leases with the current timestamp", async () => {
    await service.releaseJobConcurrencyLeases({ jobId: "job_1" });

    expect(mocks.releaseJobConcurrencyLeases).toHaveBeenCalledWith({
      jobId: "job_1",
      releasedAt: new Date("2026-07-07T12:00:00.000Z"),
    });
  });
});

function createRepository(): ModelRateLimitsRepository {
  return {
    listModelRateLimits: mocks.listModelRateLimits,
    upsertRateLimitConcurrencyLeases:
      mocks.upsertRateLimitConcurrencyLeases,
    upsertRateLimitWindowEntries: mocks.upsertRateLimitWindowEntries,
    releaseJobConcurrencyLeases: mocks.releaseJobConcurrencyLeases,
  } as unknown as ModelRateLimitsRepository;
}

function createSeedanceRateLimits(): GenerationModelRateLimitRecord[] {
  return [
    createRateLimit({
      id: "seedance-2.0-video-non-4k-rpm",
      bucketId: "byteplus-seedance-2.0-video-non-4k-rpm",
      kind: "request_window",
      conditions: {
        outputResolution: ["480p", "720p", "1080p"],
      },
    }),
    createRateLimit({
      id: "seedance-2.0-video-non-4k-concurrent-task",
      bucketId: "byteplus-seedance-2.0-video-non-4k-concurrent-task",
      kind: "concurrent_task",
      conditions: {
        outputResolution: ["480p", "720p", "1080p"],
      },
    }),
    createRateLimit({
      id: "seedance-2.0-video-4k-rpm",
      bucketId: "byteplus-seedance-2.0-video-4k-rpm",
      kind: "request_window",
      conditions: {
        outputResolution: "4k",
      },
    }),
    createRateLimit({
      id: "seedance-2.0-video-4k-concurrent-task",
      bucketId: "byteplus-seedance-2.0-video-4k-concurrent-task",
      kind: "concurrent_task",
      conditions: {
        outputResolution: "4k",
      },
    }),
  ];
}

function createRateLimit(
  overrides: Partial<GenerationModelRateLimitRecord> & {
    bucketId: string;
    kind: GenerationModelRateLimitRecord["bucket"]["kind"];
  },
): GenerationModelRateLimitRecord {
  return {
    id: overrides.id ?? "rate_limit_1",
    modelId: "seedance-2.0-video",
    bucketId: overrides.bucketId,
    conditions: overrides.conditions ?? {},
    createdAt: new Date("2026-07-07T00:00:00.000Z"),
    updatedAt: new Date("2026-07-07T00:00:00.000Z"),
    bucket: {
      id: overrides.bucketId,
      providerId: "byteplus",
      kind: overrides.kind,
      maxValue: 1,
      windowSeconds: overrides.kind === "request_window" ? 60 : null,
      windowAlignment: overrides.kind === "request_window" ? "rolling" : null,
      createdAt: new Date("2026-07-07T00:00:00.000Z"),
      updatedAt: new Date("2026-07-07T00:00:00.000Z"),
    },
  };
}
