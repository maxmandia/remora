import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { ModelRateLimitsRepository } from "./model_rate_limits.repository.ts";
import type { GenerationModelRateLimitRecord } from "./model_rate_limits.types.ts";
import { ModelRateLimitsService } from "./model_rate_limits.service.ts";

const mocks = vi.hoisted(() => ({
  getModelSpec: vi.fn(),
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
    mocks.getModelSpec.mockReset();
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
          model: {
            getModelSpec: mocks.getModelSpec,
          },
          modelRateLimits: createRepository(),
        } as unknown as TransactionManager),
    );
    mocks.listModelRateLimits.mockResolvedValue(createSeedanceRateLimits());
    mocks.getModelSpec.mockResolvedValue({ rateLimitMode: "enforced" });
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
        modelSpecId: "seedance-2.0-video-v1",
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
        modelSpecId: "seedance-2.0-video-v1",
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
        modelSpecId: "seedance-2.0-video-v1",
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
        modelSpecId: "seedance-2.0-video-v1",
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

  it("reserves Nano Banana requests 1 through 100 and delays request 101 until the oldest minute entry expires", async () => {
    mocks.listModelRateLimits.mockResolvedValue(createNanoBananaRateLimits());
    mocks.listRateLimitWindowEntries
      .mockResolvedValueOnce(createWindowEntries(99, "nano-rpm", 30_000))
      .mockResolvedValueOnce([]);

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_100",
        modelSpecId: "nano-banana-2-v1",
        providerId: "google",
        facts: { outputResolution: "1K" },
      }),
    ).resolves.toMatchObject({ status: "reserved" });

    mocks.listRateLimitWindowEntries
      .mockReset()
      .mockResolvedValueOnce(createWindowEntries(100, "nano-rpm", 30_000))
      .mockResolvedValueOnce([]);

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_101",
        modelSpecId: "nano-banana-2-v1",
        providerId: "google",
        facts: { outputResolution: "4K" },
      }),
    ).resolves.toEqual({
      status: "delayed",
      retryAt: new Date("2026-07-07T12:00:30.000Z"),
      delayMs: 30_000,
      bucketIds: ["google-gemini-3.1-flash-image-rpm"],
    });
  });

  it("reserves Nano Banana requests 1 through 1,000 and delays request 1,001 for the rolling day", async () => {
    mocks.listModelRateLimits.mockResolvedValue(createNanoBananaRateLimits());
    mocks.listRateLimitWindowEntries
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(createWindowEntries(999, "nano-rpd", 45_000));

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1000",
        modelSpecId: "nano-banana-2-v1",
        providerId: "google",
        facts: { outputResolution: "512" },
      }),
    ).resolves.toMatchObject({ status: "reserved" });

    expect(mocks.upsertRateLimitWindowEntries).toHaveBeenLastCalledWith({
      jobId: "job_1000",
      occurredAt: new Date("2026-07-07T12:00:00.000Z"),
      bucketIds: [
        "google-gemini-3.1-flash-image-rpm",
        "google-gemini-3.1-flash-image-rpd",
      ],
    });

    mocks.listRateLimitWindowEntries
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(createWindowEntries(1000, "nano-rpd", 45_000));

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1001",
        modelSpecId: "nano-banana-2-v1",
        providerId: "google",
        facts: { outputResolution: "2K" },
      }),
    ).resolves.toEqual({
      status: "delayed",
      retryAt: new Date("2026-07-07T12:00:45.000Z"),
      delayMs: 45_000,
      bucketIds: ["google-gemini-3.1-flash-image-rpd"],
    });
  });

  it("uses the later retry time when both Nano Banana request buckets bind", async () => {
    mocks.listModelRateLimits.mockResolvedValue(createNanoBananaRateLimits());
    mocks.listRateLimitWindowEntries
      .mockResolvedValueOnce(createWindowEntries(100, "nano-rpm", 30_000))
      .mockResolvedValueOnce(createWindowEntries(1000, "nano-rpd", 45_000));

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_blocked",
        modelSpecId: "nano-banana-2-v1",
        providerId: "google",
        facts: { outputResolution: "1K" },
      }),
    ).resolves.toEqual({
      status: "delayed",
      retryAt: new Date("2026-07-07T12:00:45.000Z"),
      delayMs: 45_000,
      bucketIds: [
        "google-gemini-3.1-flash-image-rpd",
        "google-gemini-3.1-flash-image-rpm",
      ],
    });
  });

  it("fails closed when no enforced rate-limit rule matches", async () => {
    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1",
        modelSpecId: "seedance-2.0-video-v1",
        providerId: "other-provider",
        facts: {
          outputResolution: "720p",
        },
      }),
    ).rejects.toMatchObject({
      code: "GENERATION_MODEL_RATE_LIMIT_CONFIGURATION_ERROR",
    });

    expect(mocks.lockRateLimitBuckets).not.toHaveBeenCalled();
  });

  it("returns immediately for explicit unlimited mode", async () => {
    mocks.getModelSpec.mockResolvedValueOnce({ rateLimitMode: "unlimited" });

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1",
        modelSpecId: "seedance-2.0-video-v1",
        providerId: "byteplus",
        facts: { outputResolution: "720p" },
      }),
    ).resolves.toEqual({
      status: "reserved",
      reservedAt: new Date("2026-07-07T12:00:00.000Z"),
    });
    expect(mocks.listModelRateLimits).not.toHaveBeenCalled();
  });

  it("fails closed for unconfigured mode", async () => {
    mocks.getModelSpec.mockResolvedValueOnce({
      rateLimitMode: "unconfigured",
    });

    await expect(
      service.reserveProviderSubmissionCapacity({
        jobId: "job_1",
        modelSpecId: "archived-model-v1",
        providerId: "byteplus",
        facts: { outputResolution: "720p" },
      }),
    ).rejects.toMatchObject({
      code: "GENERATION_MODEL_RATE_LIMIT_CONFIGURATION_ERROR",
    });
    expect(mocks.listModelRateLimits).not.toHaveBeenCalled();
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

function createNanoBananaRateLimits(): GenerationModelRateLimitRecord[] {
  return [
    createRateLimit({
      id: "nano-banana-2-v1-rpm",
      modelSpecId: "nano-banana-2-v1",
      bucketId: "google-gemini-3.1-flash-image-rpm",
      kind: "request_window",
      conditions: {},
      bucket: {
        providerId: "google",
        maxValue: 100,
        windowSeconds: 60,
      },
    }),
    createRateLimit({
      id: "nano-banana-2-v1-rpd",
      modelSpecId: "nano-banana-2-v1",
      bucketId: "google-gemini-3.1-flash-image-rpd",
      kind: "request_window",
      conditions: {},
      bucket: {
        providerId: "google",
        maxValue: 1000,
        windowSeconds: 86_400,
      },
    }),
  ];
}

function createWindowEntries(
  count: number,
  bucketId: string,
  expiresAfterNowMs: number,
) {
  const windowSeconds = bucketId === "nano-rpd" ? 86_400 : 60;
  const oldestEntryAt = new Date(
    new Date("2026-07-07T12:00:00.000Z").getTime() -
      windowSeconds * 1000 +
      expiresAfterNowMs,
  );

  return Array.from({ length: count }, (_, index) => ({
    id: `${bucketId}-entry-${index}`,
    bucketId,
    jobId: `${bucketId}-job-${index}`,
    occurredAt: new Date(oldestEntryAt.getTime() + index),
    createdAt: oldestEntryAt,
  }));
}

function createRateLimit(
  overrides: Omit<Partial<GenerationModelRateLimitRecord>, "bucket"> & {
    bucketId: string;
    kind: GenerationModelRateLimitRecord["bucket"]["kind"];
    bucket?: Partial<GenerationModelRateLimitRecord["bucket"]>;
  },
): GenerationModelRateLimitRecord {
  return {
    id: overrides.id ?? "rate_limit_1",
    modelSpecId: overrides.modelSpecId ?? "seedance-2.0-video-v1",
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
