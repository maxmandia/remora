import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyRows: [] as unknown[],
  findMany: vi.fn(),
  insertValues: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  and: vi.fn(() => ({ kind: "and" })),
  eq: vi.fn(() => ({ kind: "eq" })),
  isNull: vi.fn(() => ({ kind: "is-null" })),
}));

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  eq: mocks.eq,
  isNull: mocks.isNull,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    query: {
      generationModelRateLimit: {
        findMany: mocks.findMany,
      },
    },
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => createUpdateChain()),
  },
  schema: {
    generationModelRateLimit: {
      id: "generation_model_rate_limit.id",
      modelId: "generation_model_rate_limit.model_id",
    },
    generationRateLimitWindowEntry: {
      id: "generation_rate_limit_window_entry.id",
    },
    generationRateLimitConcurrencyLease: {
      id: "generation_rate_limit_concurrency_lease.id",
      jobId: "generation_rate_limit_concurrency_lease.job_id",
      releasedAt: "generation_rate_limit_concurrency_lease.released_at",
    },
  },
}));

import { modelRateLimitsRepository } from "./model_rate_limits.repository.ts";

describe("model rate limits repository", () => {
  beforeEach(() => {
    mocks.findManyRows = [createRateLimitRow()];
    mocks.findMany.mockReset();
    mocks.findMany.mockImplementation(async () => mocks.findManyRows);
    mocks.insertValues.mockClear();
    mocks.onConflictDoUpdate.mockClear();
    mocks.updateSet.mockClear();
    mocks.updateWhere.mockClear();
    mocks.and.mockClear();
    mocks.eq.mockClear();
    mocks.isNull.mockClear();
  });

  it("loads model rate limits with buckets", async () => {
    await expect(
      modelRateLimitsRepository.listModelRateLimits("seedance-2.0-video"),
    ).resolves.toEqual([
      {
        id: "rate_limit_1",
        modelId: "seedance-2.0-video",
        bucketId: "bucket_1",
        conditions: {
          outputResolution: "720p",
        },
        createdAt: new Date("2026-07-07T00:00:00.000Z"),
        updatedAt: new Date("2026-07-07T00:00:00.000Z"),
        bucket: {
          id: "bucket_1",
          providerId: "byteplus",
          kind: "request_window",
          maxValue: 600,
          windowSeconds: 60,
          windowAlignment: "rolling",
          createdAt: new Date("2026-07-07T00:00:00.000Z"),
          updatedAt: new Date("2026-07-07T00:00:00.000Z"),
        },
      },
    ]);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        with: {
          bucket: true,
        },
      }),
    );
  });

  it("upserts deterministic request-window entries", async () => {
    const occurredAt = new Date("2026-07-07T12:00:00.000Z");

    await modelRateLimitsRepository.upsertRateLimitWindowEntries({
      jobId: "job_1",
      bucketIds: ["bucket_1", "bucket_2"],
      occurredAt,
    });

    expect(mocks.insertValues).toHaveBeenCalledWith([
      {
        id: "generation:job:job_1:rate-limit-window:bucket_1:v1",
        bucketId: "bucket_1",
        jobId: "job_1",
        occurredAt,
      },
      {
        id: "generation:job:job_1:rate-limit-window:bucket_2:v1",
        bucketId: "bucket_2",
        jobId: "job_1",
        occurredAt,
      },
    ]);
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith({
      target: "generation_rate_limit_window_entry.id",
      set: {
        occurredAt,
      },
    });
  });

  it("upserts deterministic concurrency leases", async () => {
    const acquiredAt = new Date("2026-07-07T12:00:00.000Z");
    const expiresAt = new Date("2026-07-08T12:00:00.000Z");

    await modelRateLimitsRepository.upsertRateLimitConcurrencyLeases({
      jobId: "job_1",
      bucketIds: ["bucket_1"],
      acquiredAt,
      expiresAt,
    });

    expect(mocks.insertValues).toHaveBeenCalledWith([
      {
        id: "generation:job:job_1:rate-limit-concurrency:bucket_1:v1",
        bucketId: "bucket_1",
        jobId: "job_1",
        acquiredAt,
        expiresAt,
        releasedAt: null,
      },
    ]);
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledWith({
      target: "generation_rate_limit_concurrency_lease.id",
      set: {
        acquiredAt,
        expiresAt,
        releasedAt: null,
        updatedAt: acquiredAt,
      },
    });
  });

  it("releases unreleased concurrency leases for a job", async () => {
    const releasedAt = new Date("2026-07-07T12:00:00.000Z");

    await modelRateLimitsRepository.releaseJobConcurrencyLeases({
      jobId: "job_1",
      releasedAt,
    });

    expect(mocks.updateSet).toHaveBeenCalledWith({
      releasedAt,
      updatedAt: releasedAt,
    });
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_rate_limit_concurrency_lease.job_id",
      "job_1",
    );
    expect(mocks.isNull).toHaveBeenCalledWith(
      "generation_rate_limit_concurrency_lease.released_at",
    );
    expect(mocks.and).toHaveBeenCalledWith({ kind: "eq" }, { kind: "is-null" });
    expect(mocks.updateWhere).toHaveBeenCalledWith({ kind: "and" });
  });
});

function createInsertChain() {
  return {
    values: vi.fn((values: unknown) => {
      mocks.insertValues(values);

      return {
        onConflictDoUpdate: vi.fn((input: unknown) => {
          mocks.onConflictDoUpdate(input);

          return Promise.resolve();
        }),
      };
    }),
  };
}

function createUpdateChain() {
  return {
    set: vi.fn((values: unknown) => {
      mocks.updateSet(values);

      return {
        where: vi.fn((input: unknown) => {
          mocks.updateWhere(input);

          return Promise.resolve();
        }),
      };
    }),
  };
}

function createRateLimitRow() {
  return {
    id: "rate_limit_1",
    modelId: "seedance-2.0-video",
    bucketId: "bucket_1",
    conditions: {
      outputResolution: "720p",
    },
    createdAt: new Date("2026-07-07T00:00:00.000Z"),
    updatedAt: new Date("2026-07-07T00:00:00.000Z"),
    bucket: {
      id: "bucket_1",
      providerId: "byteplus",
      kind: "request_window",
      maxValue: 600,
      windowSeconds: 60,
      windowAlignment: "rolling",
      createdAt: new Date("2026-07-07T00:00:00.000Z"),
      updatedAt: new Date("2026-07-07T00:00:00.000Z"),
    },
  };
}
