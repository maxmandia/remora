import { describe, expect, it } from "vitest";

import type { TRPCContext } from "./context.ts";
import { router } from "./init.ts";
import { adminProcedure } from "./procedures.ts";

const testRouter = router({
  getAdmin: adminProcedure.query(({ ctx }) => ({
    role: ctx.user.role,
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
    const caller = testRouter.createCaller(createContext("user"));

    await expect(caller.getAdmin()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("provides authenticated context to admin callers", async () => {
    const caller = testRouter.createCaller(createContext("admin"));

    await expect(caller.getAdmin()).resolves.toEqual({
      role: "admin",
      userId: "user_1",
    });
  });

  it("rejects impersonated admin callers", async () => {
    const caller = testRouter.createCaller(
      createContext("admin", "administrator_1"),
    );

    await expect(caller.getAdmin()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

function createContext(
  role: "admin" | "user" | null,
  impersonatedBy: string | null = null,
): TRPCContext {
  if (role === null) {
    return {
      actorUserId: null,
      isImpersonating: false,
      requestId: "request_1",
      session: null,
      user: null,
    };
  }

  return {
    actorUserId: impersonatedBy ?? "user_1",
    isImpersonating: Boolean(impersonatedBy),
    requestId: "request_1",
    session: {
      id: "session_1",
      impersonatedBy,
    },
    user: {
      id: "user_1",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      role,
      banned: false,
      banReason: null,
      banExpires: null,
      image: null,
      createdAt: new Date("2026-07-28T00:00:00.000Z"),
      updatedAt: new Date("2026-07-28T00:00:00.000Z"),
    },
  } as unknown as TRPCContext;
}
