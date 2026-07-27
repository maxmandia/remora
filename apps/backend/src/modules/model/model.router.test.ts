import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TRPCContext } from "../../trpc/context.ts";
import { modelRouter } from "./model.router.ts";

const mocks = vi.hoisted(() => ({
  listPublished: vi.fn(),
}));

vi.mock("./model.repository.ts", () => ({
  modelRepository: {
    listPublished: mocks.listPublished,
  },
}));

describe("model router", () => {
  beforeEach(() => {
    mocks.listPublished.mockReset();
    mocks.listPublished.mockResolvedValue([
      {
        id: "seedance-2.0-video",
        displayName: "Seedance 2.0",
        type: "video",
      },
    ]);
  });

  it("lists published models without an authenticated session", async () => {
    const caller = modelRouter.createCaller(createSignedOutContext());

    await expect(caller.listPublished()).resolves.toEqual([
      {
        id: "seedance-2.0-video",
        displayName: "Seedance 2.0",
        type: "video",
      },
    ]);
    expect(mocks.listPublished).toHaveBeenCalledOnce();
  });
});

function createSignedOutContext(): TRPCContext {
  return {
    session: null,
    user: null,
  } as unknown as TRPCContext;
}
