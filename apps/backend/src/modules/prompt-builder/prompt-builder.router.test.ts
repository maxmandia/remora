import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TRPCContext } from "../../trpc/context.ts";
import { promptBuilderRouter } from "./prompt-builder.router.ts";
import { promptBuilderPromptMaxLength } from "./prompt-builder.utils.ts";

const mocks = vi.hoisted(() => ({
  build: vi.fn(),
}));

vi.mock("./prompt-builder.service.ts", () => ({
  promptBuilderService: {
    build: mocks.build,
  },
}));

describe("prompt builder router", () => {
  beforeEach(() => {
    mocks.build.mockReset();
    mocks.build.mockResolvedValue({
      modelId: "nano-banana-2",
      modelType: "image",
      prompt: "A lighthouse above a storm",
    });
  });

  it("builds prompts for signed-out callers with normalized input", async () => {
    const caller = promptBuilderRouter.createCaller(createSignedOutContext());

    await expect(
      caller.build({
        modelId: "  nano-banana-2  ",
        prompt: "  A lighthouse above a storm  ",
      }),
    ).resolves.toEqual({
      modelId: "nano-banana-2",
      modelType: "image",
      prompt: "A lighthouse above a storm",
    });
    expect(mocks.build).toHaveBeenCalledWith({
      modelId: "nano-banana-2",
      prompt: "A lighthouse above a storm",
    });
  });

  it("returns a required duration for video prompts", async () => {
    mocks.build.mockResolvedValueOnce({
      modelId: "seedance-2.0-video",
      modelType: "video",
      prompt: "A slow dolly through a glass studio",
      duration: 8,
    });
    const caller = promptBuilderRouter.createCaller(createSignedOutContext());

    await expect(
      caller.build({
        modelId: "seedance-2.0-video",
        prompt: "A glass studio",
      }),
    ).resolves.toEqual({
      modelId: "seedance-2.0-video",
      modelType: "video",
      prompt: "A slow dolly through a glass studio",
      duration: 8,
    });
  });

  it.each([
    {
      name: "a blank model id",
      input: { modelId: " ", prompt: "A prompt" },
    },
    {
      name: "an oversized model id",
      input: { modelId: "m".repeat(129), prompt: "A prompt" },
    },
    {
      name: "a blank prompt",
      input: { modelId: "nano-banana-2", prompt: "   " },
    },
    {
      name: "an oversized prompt",
      input: {
        modelId: "seedance-2.0-video",
        prompt: "a".repeat(promptBuilderPromptMaxLength + 1),
      },
    },
  ])("rejects $name", async ({ input }) => {
    const caller = promptBuilderRouter.createCaller(createSignedOutContext());

    await expect(caller.build(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.build).not.toHaveBeenCalled();
  });
});

function createSignedOutContext(): TRPCContext {
  return {
    actorUserId: null,
    isImpersonating: false,
    requestId: "request_1",
    session: null,
    user: null,
  };
}
