import { describe, expect, it } from "vitest";

import type { TRPCContext } from "./context.ts";
import { router } from "./init.ts";
import { adminProcedure } from "./procedures.ts";

const testRouter = router({
  getAdmin: adminProcedure.query(({ ctx }) => ({
    isAdmin: ctx.user.isAdmin,
    userId: ctx.user.id,
  })),
});

describe("adminProcedure", () => {
  it("rejects signed-out callers", async () => {
    const caller = testRouter.createCaller(createContext(null));

    await expect(caller.getAdmin()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects authenticated non-admin callers", async () => {
    const caller = testRouter.createCaller(createContext(false));

    await expect(caller.getAdmin()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("provides authenticated context to admin callers", async () => {
    const caller = testRouter.createCaller(createContext(true));

    await expect(caller.getAdmin()).resolves.toEqual({
      isAdmin: true,
      userId: "user_1",
    });
  });
});

function createContext(isAdmin: boolean | null): TRPCContext {
  if (isAdmin === null) {
    return {
      requestId: "request_1",
      session: null,
      user: null,
    };
  }

  return {
    requestId: "request_1",
    session: {
      id: "session_1",
    },
    user: {
      id: "user_1",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      isAdmin,
      image: null,
      createdAt: new Date("2026-07-28T00:00:00.000Z"),
      updatedAt: new Date("2026-07-28T00:00:00.000Z"),
    },
  } as TRPCContext;
}
