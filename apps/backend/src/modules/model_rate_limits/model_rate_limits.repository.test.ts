import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyRows: [] as unknown[],
  findMany: vi.fn(),
  insertValues: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  and: vi.fn(() => ({ kind: "and" })),
  asc: vi.fn(() => ({ kind: "asc" })),
  eq: vi.fn(() => ({ kind: "eq" })),
  gt: vi.fn(() => ({ kind: "gt" })),
  gte: vi.fn(() => ({ kind: "gte" })),
  inArray: vi.fn(() => ({ kind: "in-array" })),
  isNull: vi.fn(() => ({ kind: "is-null" })),
  lt: vi.fn(() => ({ kind: "lt" })),
  ne: vi.fn(() => ({ kind: "ne" })),
  selectRows: [] as unknown[],
  selectFields: vi.fn(),
  selectFrom: vi.fn(),
  selectWhere: vi.fn(),
  selectOrderBy: vi.fn(),
  selectFor: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  asc: mocks.asc,
  eq: mocks.eq,
  gt: mocks.gt,
  gte: mocks.gte,
  inArray: mocks.inArray,
  isNull: mocks.isNull,
  lt: mocks.lt,
  ne: mocks.ne,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    query: {
      generationModelRateLimit: {
        findMany: mocks.findMany,
      },
    },
    insert: vi.fn(() => createInsertChain()),
    select: vi.fn((fields?: unknown) => createSelectChain(fields)),
    update: vi.fn(() => createUpdateChain()),
  },
  schema: {
    generationModelRateLimit: {
      id: "generation_model_rate_limit.id",
      modelSpecId: "generation_model_rate_limit.model_spec_id",
    },
    generationRateLimitBucket: {
      id: "generation_rate_limit_bucket.id",
    },
    generationRateLimitWindowEntry: {
      id: "generation_rate_limit_window_entry.id",
      bucketId: "generation_rate_limit_window_entry.bucket_id",
      jobId: "generation_rate_limit_window_entry.job_id",
      occurredAt: "generation_rate_limit_window_entry.occurred_at",
    },
    generationRateLimitConcurrencyLease: {
      id: "generation_rate_limit_concurrency_lease.id",
      bucketId: "generation_rate_limit_concurrency_lease.bucket_id",
      jobId: "generation_rate_limit_concurrency_lease.job_id",
      expiresAt: "generation_rate_limit_concurrency_lease.expires_at",
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
    mocks.selectRows = [];
    mocks.selectFields.mockClear();
    mocks.selectFrom.mockClear();
    mocks.selectWhere.mockClear();
    mocks.selectOrderBy.mockClear();
    mocks.selectFor.mockClear();
    mocks.and.mockClear();
    mocks.asc.mockClear();
    mocks.eq.mockClear();
    mocks.gt.mockClear();
    mocks.gte.mockClear();
    mocks.inArray.mockClear();
    mocks.isNull.mockClear();
    mocks.lt.mockClear();
    mocks.ne.mockClear();
  });

  it("loads model rate limits with buckets", async () => {
    await expect(
      modelRateLimitsRepository.listModelRateLimits("seedance-2.0-video-v1"),
    ).resolves.toEqual([
      {
        id: "rate_limit_1",
        modelSpecId: "seedance-2.0-video-v1",
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

  it("locks rate-limit buckets in stable order", async () => {
    await modelRateLimitsRepository.lockRateLimitBuckets([
      "bucket_2",
      "bucket_1",
    ]);

    expect(mocks.selectFields).toHaveBeenCalledWith({
      id: "generation_rate_limit_bucket.id",
    });
    expect(mocks.selectFrom).toHaveBeenCalledWith({
      id: "generation_rate_limit_bucket.id",
    });
    expect(mocks.inArray).toHaveBeenCalledWith(
      "generation_rate_limit_bucket.id",
      ["bucket_2", "bucket_1"],
    );
    expect(mocks.asc).toHaveBeenCalledWith("generation_rate_limit_bucket.id");
    expect(mocks.selectFor).toHaveBeenCalledWith("update");
  });

  it("lists window entries for the requested bucket range excluding the current job entry", async () => {
    const entry = {
      id: "entry_1",
      bucketId: "bucket_1",
      jobId: "job_2",
      occurredAt: new Date("2026-07-07T12:00:00.000Z"),
      createdAt: new Date("2026-07-07T12:00:00.000Z"),
    };
    mocks.selectRows = [entry];

    await expect(
      modelRateLimitsRepository.listRateLimitWindowEntries({
        bucketId: "bucket_1",
        occurredAtStart: new Date("2026-07-07T11:59:00.000Z"),
        includeOccurredAtStart: false,
        occurredAtEnd: new Date("2026-07-07T12:01:00.000Z"),
        excludedEntryId: "entry_current",
      }),
    ).resolves.toEqual([entry]);

    expect(mocks.gt).toHaveBeenCalledWith(
      "generation_rate_limit_window_entry.occurred_at",
      new Date("2026-07-07T11:59:00.000Z"),
    );
    expect(mocks.lt).toHaveBeenCalledWith(
      "generation_rate_limit_window_entry.occurred_at",
      new Date("2026-07-07T12:01:00.000Z"),
    );
    expect(mocks.ne).toHaveBeenCalledWith(
      "generation_rate_limit_window_entry.id",
      "entry_current",
    );
  });

  it("lists active concurrency leases excluding the current job lease", async () => {
    const lease = {
      id: "lease_1",
      bucketId: "bucket_1",
      jobId: "job_2",
      acquiredAt: new Date("2026-07-07T12:00:00.000Z"),
      expiresAt: new Date("2026-07-08T12:00:00.000Z"),
      releasedAt: null,
      createdAt: new Date("2026-07-07T12:00:00.000Z"),
      updatedAt: new Date("2026-07-07T12:00:00.000Z"),
    };
    mocks.selectRows = [lease];

    await expect(
      modelRateLimitsRepository.listActiveRateLimitConcurrencyLeases({
        bucketId: "bucket_1",
        activeAt: new Date("2026-07-07T12:00:00.000Z"),
        excludedLeaseId: "lease_current",
      }),
    ).resolves.toEqual([lease]);

    expect(mocks.isNull).toHaveBeenCalledWith(
      "generation_rate_limit_concurrency_lease.released_at",
    );
    expect(mocks.gt).toHaveBeenCalledWith(
      "generation_rate_limit_concurrency_lease.expires_at",
      new Date("2026-07-07T12:00:00.000Z"),
    );
    expect(mocks.ne).toHaveBeenCalledWith(
      "generation_rate_limit_concurrency_lease.id",
      "lease_current",
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

function createSelectChain(fields: unknown) {
  mocks.selectFields(fields);

  return {
    from: vi.fn((table: unknown) => {
      mocks.selectFrom(table);

      return {
        where: vi.fn((input: unknown) => {
          mocks.selectWhere(input);

          return {
            limit: vi.fn(async () => mocks.selectRows),
            orderBy: vi.fn((...input: unknown[]) => {
              mocks.selectOrderBy(input);

              return createSelectableOrderByResult();
            }),
          };
        }),
      };
    }),
  };
}

function createSelectableOrderByResult() {
  return {
    for: vi.fn((input: unknown) => {
      mocks.selectFor(input);

      return Promise.resolve(mocks.selectRows);
    }),
    then: (
      resolve: (value: unknown[]) => void,
      reject: (reason?: unknown) => void,
    ) => Promise.resolve(mocks.selectRows).then(resolve, reject),
  };
}

function createRateLimitRow() {
  return {
    id: "rate_limit_1",
    modelSpecId: "seedance-2.0-video-v1",
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
