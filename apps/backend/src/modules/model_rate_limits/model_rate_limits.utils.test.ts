import { describe, expect, it } from "vitest";

import {
  GenerationModelRateLimitConfigurationError,
  type GenerationModelRateLimitConditions,
} from "./model_rate_limits.types.ts";
import {
  createGenerationRateLimitConcurrencyLeaseId,
  createGenerationRateLimitWindowEntryId,
  matchesGenerationModelRateLimitConditions,
} from "./model_rate_limits.utils.ts";

describe("model rate limit utils", () => {
  it("matches empty conditions", () => {
    expect(
      matchesGenerationModelRateLimitConditions({
        conditions: {},
        facts: { outputResolution: "720p" },
      }),
    ).toBe(true);
  });

  it("matches exact output resolution conditions", () => {
    expect(
      matchesGenerationModelRateLimitConditions({
        conditions: { outputResolution: "4k" },
        facts: { outputResolution: "4k" },
      }),
    ).toBe(true);
  });

  it("matches array output resolution conditions", () => {
    expect(
      matchesGenerationModelRateLimitConditions({
        conditions: { outputResolution: ["480p", "720p", "1080p"] },
        facts: { outputResolution: "720p" },
      }),
    ).toBe(true);
  });

  it("rejects nonmatching output resolution conditions", () => {
    expect(
      matchesGenerationModelRateLimitConditions({
        conditions: { outputResolution: "4k" },
        facts: { outputResolution: "720p" },
      }),
    ).toBe(false);
  });

  it("throws on unknown condition keys", () => {
    expect(() =>
      matchesGenerationModelRateLimitConditions({
        conditions: {
          unknown: true,
        } as GenerationModelRateLimitConditions,
        facts: { outputResolution: "720p" },
      }),
    ).toThrow(GenerationModelRateLimitConfigurationError);
  });

  it("throws on unsupported condition values", () => {
    expect(() =>
      matchesGenerationModelRateLimitConditions({
        conditions: {
          outputResolution: 720,
        } as unknown as GenerationModelRateLimitConditions,
        facts: { outputResolution: "720p" },
      }),
    ).toThrow(GenerationModelRateLimitConfigurationError);
  });

  it("creates deterministic accounting ids", () => {
    expect(
      createGenerationRateLimitWindowEntryId({
        jobId: "job_1",
        bucketId: "bucket_1",
      }),
    ).toBe("generation:job:job_1:rate-limit-window:bucket_1:v1");
    expect(
      createGenerationRateLimitConcurrencyLeaseId({
        jobId: "job_1",
        bucketId: "bucket_1",
      }),
    ).toBe("generation:job:job_1:rate-limit-concurrency:bucket_1:v1");
  });
});
