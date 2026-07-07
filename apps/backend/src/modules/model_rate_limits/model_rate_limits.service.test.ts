import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { ModelRateLimitsRepository } from "./model_rate_limits.repository.ts";
import type { GenerationModelRateLimitRecord } from "./model_rate_limits.types.ts";
import { ModelRateLimitsService } from "./model_rate_limits.service.ts";

const mocks = vi.hoisted(() => ({
  listModelRateLimits: vi.fn(),
  lockRateLimitBuckets: vi.fn(),
  listRateLimitWindowEntries: vi.fn(),
  listActiveRateLimitConcurrencyLeases: vi.fn(),
  upsertRateLimitConcurrencyLeases: vi.fn(),
  upsertRateLimitWindowEntries: vi.fn(),
  releaseJobConcurrencyLeases: vi.fn(),
  transaction: vi.fn(),
}));

describe("model rate limits service", () => {
  let service: ModelRateLimitsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
    mocks.listModelRateLimits.mockReset();
    mocks.lockRateLimitBuckets.mockReset();
    mocks.listRateLimitWindowEntries.mockReset();
    mocks.listActiveRateLimitConcurrencyLeases.mockReset();
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
    mocks.lockRateLimitBuckets.mockResolvedValue(undefined);
    mocks.listRateLimitWindowEntries.mockResolvedValue([]);
    mocks.listActiveRateLimitConcurrencyLeases.mockResolvedValue([]);
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

  it("reserves matching request and concurrency buckets when capacity is available", async () => {
    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1",
        modelId: "seedance-2.0-video",
        providerId: "byteplus",
        facts: {
          outputResolution: "720p",
        },
      }),
    ).resolves.toEqual({
      status: "reserved",
      reservedAt: new Date("2026-07-07T12:00:00.000Z"),
    });

    expect(mocks.lockRateLimitBuckets).toHaveBeenCalledWith([
      "byteplus-seedance-2.0-video-non-4k-concurrent-task",
      "byteplus-seedance-2.0-video-non-4k-rpm",
    ]);
    expect(mocks.listRateLimitWindowEntries).toHaveBeenCalledWith({
      bucketId: "byteplus-seedance-2.0-video-non-4k-rpm",
      occurredAtStart: new Date("2026-07-07T11:59:00.000Z"),
      includeOccurredAtStart: false,
      excludedEntryId:
        "generation:job:job_1:rate-limit-window:byteplus-seedance-2.0-video-non-4k-rpm:v1",
    });
    expect(mocks.listActiveRateLimitConcurrencyLeases).toHaveBeenCalledWith({
      bucketId: "byteplus-seedance-2.0-video-non-4k-concurrent-task",
      activeAt: new Date("2026-07-07T12:00:00.000Z"),
      excludedLeaseId:
        "generation:job:job_1:rate-limit-concurrency:byteplus-seedance-2.0-video-non-4k-concurrent-task:v1",
    });
    expect(mocks.upsertRateLimitWindowEntries).toHaveBeenCalledWith({
      jobId: "job_1",
      occurredAt: new Date("2026-07-07T12:00:00.000Z"),
      bucketIds: ["byteplus-seedance-2.0-video-non-4k-rpm"],
    });
    expect(mocks.upsertRateLimitConcurrencyLeases).toHaveBeenCalledWith({
      jobId: "job_1",
      acquiredAt: new Date("2026-07-07T12:00:00.000Z"),
      expiresAt: new Date("2026-07-08T12:00:00.000Z"),
      bucketIds: ["byteplus-seedance-2.0-video-non-4k-concurrent-task"],
    });
  });

  it("delays without writing ledger rows when the request window is full", async () => {
    mocks.listRateLimitWindowEntries.mockResolvedValueOnce([
      {
        id: "entry_1",
        bucketId: "byteplus-seedance-2.0-video-non-4k-rpm",
        jobId: "other_job",
        occurredAt: new Date("2026-07-07T11:59:30.000Z"),
        createdAt: new Date("2026-07-07T11:59:30.000Z"),
      },
    ]);

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1",
        modelId: "seedance-2.0-video",
        providerId: "byteplus",
        facts: {
          outputResolution: "720p",
        },
      }),
    ).resolves.toEqual({
      status: "delayed",
      retryAt: new Date("2026-07-07T12:00:30.000Z"),
      delayMs: 30_000,
      bucketIds: ["byteplus-seedance-2.0-video-non-4k-rpm"],
    });

    expect(mocks.upsertRateLimitWindowEntries).not.toHaveBeenCalled();
    expect(mocks.upsertRateLimitConcurrencyLeases).not.toHaveBeenCalled();
  });

  it("delays without writing ledger rows when concurrency is full", async () => {
    mocks.listActiveRateLimitConcurrencyLeases.mockResolvedValueOnce([
      {
        id: "lease_1",
        bucketId: "byteplus-seedance-2.0-video-non-4k-concurrent-task",
        jobId: "other_job",
        acquiredAt: new Date("2026-07-07T11:59:00.000Z"),
        expiresAt: new Date("2026-07-07T12:00:05.000Z"),
        releasedAt: null,
        createdAt: new Date("2026-07-07T11:59:00.000Z"),
        updatedAt: new Date("2026-07-07T11:59:00.000Z"),
      },
    ]);

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1",
        modelId: "seedance-2.0-video",
        providerId: "byteplus",
        facts: {
          outputResolution: "720p",
        },
      }),
    ).resolves.toEqual({
      status: "delayed",
      retryAt: new Date("2026-07-07T12:00:05.000Z"),
      delayMs: 5_000,
      bucketIds: ["byteplus-seedance-2.0-video-non-4k-concurrent-task"],
    });

    expect(mocks.upsertRateLimitWindowEntries).not.toHaveBeenCalled();
    expect(mocks.upsertRateLimitConcurrencyLeases).not.toHaveBeenCalled();
  });

  it("uses the short concurrency poll interval when leases expire later", async () => {
    mocks.listActiveRateLimitConcurrencyLeases.mockResolvedValueOnce([
      {
        id: "lease_1",
        bucketId: "byteplus-seedance-2.0-video-non-4k-concurrent-task",
        jobId: "other_job",
        acquiredAt: new Date("2026-07-07T11:59:00.000Z"),
        expiresAt: new Date("2026-07-08T12:00:00.000Z"),
        releasedAt: null,
        createdAt: new Date("2026-07-07T11:59:00.000Z"),
        updatedAt: new Date("2026-07-07T11:59:00.000Z"),
      },
    ]);

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1",
        modelId: "seedance-2.0-video",
        providerId: "byteplus",
        facts: {
          outputResolution: "720p",
        },
      }),
    ).resolves.toEqual({
      status: "delayed",
      retryAt: new Date("2026-07-07T12:00:10.000Z"),
      delayMs: 10_000,
      bucketIds: ["byteplus-seedance-2.0-video-non-4k-concurrent-task"],
    });
  });

  it("ignores rate limits for other providers", async () => {
    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1",
        modelId: "seedance-2.0-video",
        providerId: "other-provider",
        facts: {
          outputResolution: "720p",
        },
      }),
    ).resolves.toEqual({
      status: "reserved",
      reservedAt: new Date("2026-07-07T12:00:00.000Z"),
    });

    expect(mocks.lockRateLimitBuckets).toHaveBeenCalledWith([]);
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
    lockRateLimitBuckets: mocks.lockRateLimitBuckets,
    listRateLimitWindowEntries: mocks.listRateLimitWindowEntries,
    listActiveRateLimitConcurrencyLeases:
      mocks.listActiveRateLimitConcurrencyLeases,
    upsertRateLimitConcurrencyLeases: mocks.upsertRateLimitConcurrencyLeases,
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
      ...overrides.bucket,
    },
  };
}
