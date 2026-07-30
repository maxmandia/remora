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
    mocks.build.mockImplementation(async (input) => input);
  });

  it("builds prompts for signed-out callers with normalized input", async () => {
    const caller = promptBuilderRouter.createCaller(createSignedOutContext());

    await expect(
      caller.build({
        modelType: "image",
        prompt: "  A lighthouse above a storm  ",
      }),
    ).resolves.toEqual({
      modelType: "image",
      prompt: "A lighthouse above a storm",
    });
    expect(mocks.build).toHaveBeenCalledWith({
      modelType: "image",
      prompt: "A lighthouse above a storm",
    });
  });

  it("returns a required duration for video prompts", async () => {
    mocks.build.mockResolvedValueOnce({
      modelType: "video",
      prompt: "A slow dolly through a glass studio",
      duration: 8,
    });
    const caller = promptBuilderRouter.createCaller(createSignedOutContext());

    await expect(
      caller.build({
        modelType: "video",
        prompt: "A glass studio",
      }),
    ).resolves.toEqual({
      modelType: "video",
      prompt: "A slow dolly through a glass studio",
      duration: 8,
    });
  });

  it.each([
    {
      name: "an unsupported model type",
      input: { modelType: "audio" as "image", prompt: "A prompt" },
    },
    {
      name: "a blank prompt",
      input: { modelType: "image" as const, prompt: "   " },
    },
    {
      name: "an oversized prompt",
      input: {
        modelType: "video" as const,
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
