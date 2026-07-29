import { describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { AuthRepository } from "../auth/auth.repository.ts";
import type { CreditsService } from "../credits/credits.service.ts";
import type { PromotionRepository } from "./promotion.repository.ts";
import { PromotionService } from "./promotion.service.ts";
import {
  guestGenerationPromotionAmountUsdMicros,
  guestGenerationPromotionOfferVersion,
  guestGenerationPromotionTicketLifetimeMs,
  PromotionAccountIneligibleError,
  PromotionClaimNotFoundError,
  PromotionDisabledError,
  PromotionVerificationRequiredError,
  type PromotionClaimRecord,
} from "./promotion.types.ts";

vi.mock("../auth/auth.repository.ts", () => ({
  authRepository: {},
}));

vi.mock("./promotion.repository.ts", () => ({
  promotionRepository: {},
}));

const secret = "promotion-signing-secret-with-32-characters";
const issuedAt = new Date("2026-07-26T12:00:00.000Z");
const ticketId = "11111111-1111-4111-8111-111111111111";

describe("PromotionService", () => {
  it("prevents issuance while the promotion is disabled", () => {
    const { service } = createHarness({
      enabled: false,
    });

    expect(() => service.issueTicket()).toThrow(PromotionDisabledError);
  });

  it("issues the server-defined offer without persisting a claim", () => {
    const { createClaim, service } = createHarness();

    expect(service.issueTicket()).toEqual({
      ticket: expect.any(String),
      offerVersion: "guest_generation_v2",
      amountUsdMicros: 1_000_000,
      expiresAt: new Date(
        issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs,
      ).toISOString(),
    });
    expect(createClaim).not.toHaveBeenCalled();
  });

  it.each([
    issuedAt,
    new Date(issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs),
  ])("claims for accounts created at ticket boundary %s", async (createdAt) => {
    const harness = createHarness({ createdAt });
    const ticket = harness.service.issueTicket().ticket;

    await expect(
      harness.service.claim({ ticket, userId: "user_1" }),
    ).resolves.toEqual({
      status: "verification_required",
    });
    expect(harness.createClaim).toHaveBeenCalledWith({
      userId: "user_1",
      id: ticketId,
      offerVersion: guestGenerationPromotionOfferVersion,
      amountUsdMicros: guestGenerationPromotionAmountUsdMicros,
      ticketIssuedAt: issuedAt,
      ticketExpiresAt: new Date(
        issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs,
      ),
    });
  });

  it.each([
    new Date(issuedAt.getTime() - 1),
    new Date(issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs + 1),
  ])(
    "rejects accounts created outside the ticket window",
    async (createdAt) => {
      const harness = createHarness({ createdAt });
      const ticket = harness.service.issueTicket().ticket;

      await expect(
        harness.service.claim({ ticket, userId: "user_1" }),
      ).rejects.toBeInstanceOf(PromotionAccountIneligibleError);
      expect(harness.createClaim).not.toHaveBeenCalled();
    },
  );

  it.each([
    { emailVerified: false, expected: "verification_required" },
    { emailVerified: true, expected: "eligible" },
  ] as const)(
    "reports $expected from persisted verification state",
    async ({ emailVerified, expected }) => {
      const { service } = createHarness({
        claim: createClaim(),
        emailVerified,
      });

      await expect(service.getStatus("user_1")).resolves.toEqual({
        status: expected,
      });
    },
  );

  it("reports none without a claim and redeemed without loading the user", async () => {
    const withoutClaim = createHarness({ claim: null });
    await expect(withoutClaim.service.getStatus("user_1")).resolves.toEqual({
      status: "none",
    });

    const redeemed = createHarness({
      claim: createClaim({
        redeemedAt: issuedAt,
        creditLedgerEntryId: "ledger_1",
      }),
    });
    await expect(redeemed.service.getStatus("user_1")).resolves.toEqual({
      status: "redeemed",
    });
    expect(redeemed.getUserById).not.toHaveBeenCalled();
  });

  it("tracks email verification only for a claimed guest account", async () => {
    const claimed = createHarness();

    await expect(
      claimed.service.trackEmailVerified({
        occurredAt: issuedAt,
        userId: "user_1",
      }),
    ).resolves.toBeUndefined();
    expect(claimed.analytics.track).toHaveBeenCalledWith(
      {
        type: "guest_generation_email_verified",
        userId: "user_1",
        occurredAt: issuedAt,
        promotionClaimId: ticketId,
        offerVersion: guestGenerationPromotionOfferVersion,
      },
      { suppressed: false },
    );

    const ordinaryAccount = createHarness({ claim: null });
    await ordinaryAccount.service.trackEmailVerified({
      occurredAt: issuedAt,
      userId: "user_1",
    });
    expect(ordinaryAccount.analytics.track).not.toHaveBeenCalled();
  });

  it("contains verification analytics failures", async () => {
    const harness = createHarness();
    const error = new Error("analytics failed");
    harness.analytics.track.mockImplementation(() => {
      throw error;
    });

    await expect(
      harness.service.trackEmailVerified({
        occurredAt: issuedAt,
        userId: "user_1",
      }),
    ).resolves.toBeUndefined();
    expect(harness.reportError).toHaveBeenCalledWith(
      "Guest generation verification analytics failed",
      error,
    );
  });

  it("requires a claim and current persisted verification before redemption", async () => {
    const withoutClaim = createHarness({ claim: null });
    await expect(withoutClaim.service.redeem("user_1")).rejects.toBeInstanceOf(
      PromotionClaimNotFoundError,
    );

    const unverified = createHarness({ emailVerified: false });
    await expect(unverified.service.redeem("user_1")).rejects.toBeInstanceOf(
      PromotionVerificationRequiredError,
    );
    expect(unverified.grantPromotionalCredit).not.toHaveBeenCalled();
  });

  it("grants credit and marks the claim redeemed in one transaction", async () => {
    const harness = createHarness({ emailVerified: true });

    await expect(harness.service.redeem("user_1")).resolves.toEqual({
      status: "redeemed",
    });
    expect(harness.grantPromotionalCredit).toHaveBeenCalledWith({
      userId: "user_1",
      promotionClaimId: ticketId,
      offerVersion: guestGenerationPromotionOfferVersion,
      amountUsdMicros: guestGenerationPromotionAmountUsdMicros,
    });
    expect(harness.markClaimRedeemed).toHaveBeenCalledWith({
      claimId: ticketId,
      creditLedgerEntryId: "ledger_1",
      redeemedAt: issuedAt,
    });
  });

  it("does not mark redemption when the credit grant fails", async () => {
    const harness = createHarness({ emailVerified: true });
    const error = new Error("credit grant failed");
    harness.grantPromotionalCredit.mockRejectedValue(error);

    await expect(harness.service.redeem("user_1")).rejects.toBe(error);
    expect(harness.markClaimRedeemed).not.toHaveBeenCalled();
  });

  it("returns redeemed idempotently without a second credit grant", async () => {
    const harness = createHarness({
      claim: createClaim({
        redeemedAt: issuedAt,
        creditLedgerEntryId: "ledger_1",
      }),
    });

    await expect(harness.service.redeem("user_1")).resolves.toEqual({
      status: "redeemed",
    });
    expect(harness.grantPromotionalCredit).not.toHaveBeenCalled();
  });

  it("serializes concurrent redemption and grants credit once", async () => {
    const harness = createHarness({
      emailVerified: true,
      serializeTransactions: true,
    });

    await expect(
      Promise.all([
        harness.service.redeem("user_1"),
        harness.service.redeem("user_1"),
      ]),
    ).resolves.toEqual([{ status: "redeemed" }, { status: "redeemed" }]);
    expect(harness.grantPromotionalCredit).toHaveBeenCalledTimes(1);
    expect(harness.markClaimRedeemed).toHaveBeenCalledTimes(1);
  });
});

function createHarness({
  claim = createClaim(),
  createdAt = new Date(issuedAt.getTime() + 1),
  emailVerified = false,
  enabled = true,
  serializeTransactions = false,
}: {
  claim?: PromotionClaimRecord | null;
  createdAt?: Date;
  emailVerified?: boolean;
  enabled?: boolean;
  serializeTransactions?: boolean;
} = {}) {
  let currentClaim = claim;
  const getUserById = vi.fn().mockResolvedValue({
    id: "user_1",
    createdAt,
    emailVerified,
  });
  const createClaimMock = vi.fn(async () => {
    currentClaim = createClaim();
    return currentClaim;
  });
  const getClaimByUserId = vi.fn(async () => currentClaim);
  const lockClaimByUserId = vi.fn(async () => currentClaim);
  const markClaimRedeemed = vi.fn(
    async ({
      creditLedgerEntryId,
      redeemedAt,
    }: {
      creditLedgerEntryId: string;
      redeemedAt: Date;
    }) => {
      if (!currentClaim) {
        throw new Error("claim missing");
      }

      currentClaim = {
        ...currentClaim,
        creditLedgerEntryId,
        redeemedAt,
      };
    },
  );
  const grantPromotionalCredit = vi.fn().mockResolvedValue({
    userId: "user_1",
    availableCreditAmountUsdMicros: guestGenerationPromotionAmountUsdMicros,
    reservedCreditAmountUsdMicros: 0,
    ledgerEntryId: "ledger_1",
  });
  const repository = {
    createClaim: createClaimMock,
    getClaimByUserId,
    lockClaimByUserId,
    markClaimRedeemed,
  } as unknown as PromotionRepository;
  const auth = { getUserById } as unknown as AuthRepository;
  const transaction = {
    auth,
    promotion: repository,
    services: {
      credits: {
        grantPromotionalCredit,
      } as unknown as CreditsService,
    },
  } as unknown as TransactionManager;
  let transactionQueue = Promise.resolve();
  const transactionManager = {
    transaction: vi.fn(
      async (
        callback: (activeTransaction: TransactionManager) => Promise<unknown>,
      ) => {
        if (!serializeTransactions) {
          return callback(transaction);
        }

        const priorTransaction = transactionQueue;
        let releaseTransaction!: () => void;
        transactionQueue = new Promise<void>((resolve) => {
          releaseTransaction = resolve;
        });
        await priorTransaction;

        try {
          return await callback(transaction);
        } finally {
          releaseTransaction();
        }
      },
    ),
  } as unknown as TransactionManager;
  const analytics = {
    track: vi.fn(),
  };
  const reportError = vi.fn();
  const service = new PromotionService(repository, {
    analytics,
    authRepository: auth,
    config: {
      PROMOTION_ENABLED: enabled,
      PROMOTION_TICKET_SIGNING_SECRET: secret,
    },
    createTicketId: () => ticketId,
    now: () => issuedAt,
    reportError,
    transactionManager,
  });

  return {
    analytics,
    createClaim: createClaimMock,
    getUserById,
    grantPromotionalCredit,
    markClaimRedeemed,
    reportError,
    service,
  };
}

function createClaim(
  overrides: Partial<PromotionClaimRecord> = {},
): PromotionClaimRecord {
  return {
    id: ticketId,
    userId: "user_1",
    offerVersion: guestGenerationPromotionOfferVersion,
    amountUsdMicros: guestGenerationPromotionAmountUsdMicros,
    ticketIssuedAt: issuedAt,
    ticketExpiresAt: new Date(
      issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs,
    ),
    createdAt: issuedAt,
    redeemedAt: null,
    creditLedgerEntryId: null,
    ...overrides,
  };
}
