import { beforeEach, describe, expect, it, vi } from "vitest";

import { modelRatesRouter } from "./model_rates.router.ts";

import type { TRPCContext } from "../../trpc/context.ts";

const mocks = vi.hoisted(() => ({
  estimateGenerationCostForAllJobs: vi.fn(),
}));

vi.mock("../../app.service.ts", () => ({
  modelRatesService: {
    estimateGenerationCostForAllJobs: mocks.estimateGenerationCostForAllJobs,
  },
}));

describe("model rates router", () => {
  beforeEach(() => {
    mocks.estimateGenerationCostForAllJobs.mockReset();
    mocks.estimateGenerationCostForAllJobs.mockReturnValue({
      estimatedCostUsdMicros: 0,
      currencyCode: "USD",
    });
  });

  it("returns a generation cost estimate", async () => {
    const caller = modelRatesRouter.createCaller(createSignedInContext());
    const input = {
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      requestedGenerations: 2,
      attachmentMedia: {
        images: [{ role: "reference" as const }],
        videos: [{ role: "reference" as const }],
      },
    };

    await expect(caller.estimateGenerationCost(input)).resolves.toEqual({
      estimatedCostUsdMicros: 0,
      currencyCode: "USD",
    });
    expect(mocks.estimateGenerationCostForAllJobs).toHaveBeenCalledWith(input);
  });

  it("validates estimate input before calling the service", async () => {
    const caller = modelRatesRouter.createCaller(createSignedInContext());

    await expect(
      caller.estimateGenerationCost({
        modelId: "",
        modelSpecId: "seedance-2.0-video-v1",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.estimateGenerationCostForAllJobs).not.toHaveBeenCalled();
  });
});

function createSignedInContext(): TRPCContext {
  return {
    session: {
      id: "session_1",
    },
    user: {
      id: "user_1",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      image: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    },
  } as unknown as TRPCContext;
}
