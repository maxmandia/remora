import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TRPCContext } from "../../trpc/context.ts";
import { promotionRouter } from "./promotion.router.ts";
import {
  InvalidPromotionTicketError,
  PromotionAccountIneligibleError,
  PromotionClaimConflictError,
  PromotionClaimNotFoundError,
  PromotionDisabledError,
  PromotionVerificationRequiredError,
} from "./promotion.types.ts";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  getStatus: vi.fn(),
  issueTicket: vi.fn(),
  redeem: vi.fn(),
}));

vi.mock("../../app.service.ts", () => ({
  promotionService: mocks,
}));

describe("promotion router", () => {
  beforeEach(() => {
    mocks.claim.mockReset();
    mocks.claim.mockResolvedValue({ status: "verification_required" });
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValue({ status: "eligible" });
    mocks.issueTicket.mockReset();
    mocks.issueTicket.mockReturnValue({
      ticket: "promotion-ticket",
      offerVersion: "guest_generation_v1",
      amountUsdMicros: 5_000_000,
      expiresAt: "2026-07-27T12:00:00.000Z",
    });
    mocks.redeem.mockReset();
    mocks.redeem.mockResolvedValue({ status: "redeemed" });
  });

  it("issues tickets without authentication", async () => {
    const caller = promotionRouter.createCaller(createSignedOutContext());

    await expect(caller.issueTicket()).resolves.toEqual({
      ticket: "promotion-ticket",
      offerVersion: "guest_generation_v1",
      amountUsdMicros: 5_000_000,
      expiresAt: "2026-07-27T12:00:00.000Z",
    });
  });

  it("requires authentication for claim, status, and redemption", async () => {
    const caller = promotionRouter.createCaller(createSignedOutContext());

    await expect(
      caller.claim({ ticket: "promotion-ticket" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.getStatus()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.redeem()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("claims tickets for the authenticated user", async () => {
    const caller = promotionRouter.createCaller(createSignedInContext());

    await expect(caller.claim({ ticket: "promotion-ticket" })).resolves.toEqual(
      { status: "verification_required" },
    );
    expect(mocks.claim).toHaveBeenCalledWith({
      userId: "user_1",
      ticket: "promotion-ticket",
    });
  });

  it.each(["", "a".repeat(4_097)])(
    "rejects invalid ticket input",
    async (ticket) => {
      const caller = promotionRouter.createCaller(createSignedInContext());

      await expect(caller.claim({ ticket })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mocks.claim).not.toHaveBeenCalled();
    },
  );

  it("gets status and redeems for the authenticated user", async () => {
    const caller = promotionRouter.createCaller(createSignedInContext());

    await expect(caller.getStatus()).resolves.toEqual({
      status: "eligible",
    });
    await expect(caller.redeem()).resolves.toEqual({
      status: "redeemed",
    });
    expect(mocks.getStatus).toHaveBeenCalledWith("user_1");
    expect(mocks.redeem).toHaveBeenCalledWith("user_1");
  });

  it.each([
    {
      operation: "issueTicket",
      error: new PromotionDisabledError(),
      code: "PRECONDITION_FAILED",
    },
    {
      operation: "claim",
      error: new InvalidPromotionTicketError(),
      code: "BAD_REQUEST",
    },
    {
      operation: "claim",
      error: new PromotionAccountIneligibleError(),
      code: "FORBIDDEN",
    },
    {
      operation: "claim",
      error: new PromotionClaimConflictError(),
      code: "CONFLICT",
    },
    {
      operation: "redeem",
      error: new PromotionClaimNotFoundError(),
      code: "NOT_FOUND",
    },
    {
      operation: "redeem",
      error: new PromotionVerificationRequiredError(),
      code: "PRECONDITION_FAILED",
    },
  ] as const)(
    "maps $operation domain errors to $code",
    async ({ code, error, operation }) => {
      const caller = promotionRouter.createCaller(createSignedInContext());

      if (operation === "issueTicket") {
        mocks.issueTicket.mockImplementation(() => {
          throw error;
        });
      } else {
        mocks[operation].mockRejectedValue(error);
      }

      const result =
        operation === "issueTicket"
          ? caller.issueTicket()
          : operation === "claim"
            ? caller.claim({ ticket: "promotion-ticket" })
            : caller.redeem();

      await expect(result).rejects.toMatchObject({ code });
    },
  );
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
      emailVerified: false,
      image: null,
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z",
    },
  } as unknown as TRPCContext;
}

function createSignedOutContext(): TRPCContext {
  return {
    session: null,
    user: null,
  } as unknown as TRPCContext;
}
