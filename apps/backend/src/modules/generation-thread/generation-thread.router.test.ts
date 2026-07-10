import { beforeEach, describe, expect, it, vi } from "vitest";

import { generationThreadRouter } from "./generation-thread.router.ts";
import type { TRPCContext } from "../../trpc/context.ts";

const mocks = vi.hoisted(() => ({
  listThreadsWithoutProjectForUser: vi.fn(),
}));

vi.mock("./generation-thread.repository.ts", () => ({
  generationThreadRepository: {
    listThreadsWithoutProjectForUser: mocks.listThreadsWithoutProjectForUser,
  },
}));

describe("generation thread router", () => {
  beforeEach(() => {
    mocks.listThreadsWithoutProjectForUser.mockReset();
    mocks.listThreadsWithoutProjectForUser.mockResolvedValue([
      {
        id: "thread_1",
        name: "Quiet Ocean Studio",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
  });

  it("lists standalone threads for the signed-in user", async () => {
    const caller = generationThreadRouter.createCaller(createSignedInContext());

    await expect(caller.listWithoutProject()).resolves.toEqual([
      {
        id: "thread_1",
        name: "Quiet Ocean Studio",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
    expect(mocks.listThreadsWithoutProjectForUser).toHaveBeenCalledWith(
      "user_1",
    );
  });
});

function createSignedInContext(): TRPCContext {
  return {
    session: {
      id: "session_1",
    },
    requestId: "request_1",
    user: {
      id: "user_1",
      name: "User",
      email: "user@example.com",
      emailVerified: true,
      image: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  } as unknown as TRPCContext;
}
