import { beforeEach, describe, expect, it, vi } from "vitest";

import { PromotionRepository } from "./promotion.repository.ts";
import { PromotionClaimConflictError } from "./promotion.types.ts";

const claim = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user_1",
  offerVersion: "guest_generation_v1" as const,
  amountUsdMicros: 5_000_000,
  ticketIssuedAt: new Date("2026-07-26T12:00:00.000Z"),
  ticketExpiresAt: new Date("2026-07-27T12:00:00.000Z"),
  createdAt: new Date("2026-07-26T12:01:00.000Z"),
  redeemedAt: null,
  creditLedgerEntryId: null,
};

const mocks = vi.hoisted(() => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  forUpdate: vi.fn(),
  insertError: null as unknown,
  insertRows: [] as unknown[],
  insertValues: vi.fn(),
  isNull: vi.fn(() => ({})),
  selectRows: [] as unknown[],
  updateRows: [] as unknown[],
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  eq: mocks.eq,
  isNull: mocks.isNull,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    insert: vi.fn(() => createInsertChain()),
    select: vi.fn(() => createSelectChain()),
    update: vi.fn(() => createUpdateChain()),
  },
  schema: {
    promotionClaim: {
      id: "promotion_claim.id",
      userId: "promotion_claim.user_id",
      creditLedgerEntryId: "promotion_claim.credit_ledger_entry_id",
      redeemedAt: "promotion_claim.redeemed_at",
    },
  },
}));

describe("PromotionRepository", () => {
  beforeEach(() => {
    mocks.forUpdate.mockClear();
    mocks.insertError = null;
    mocks.insertRows = [claim];
    mocks.insertValues.mockClear();
    mocks.selectRows = [claim];
    mocks.updateRows = [{ id: claim.id }];
    mocks.updateSet.mockClear();
    mocks.updateWhere.mockClear();
  });

  it("creates a promotion claim with server-validated values", async () => {
    const repository = new PromotionRepository();

    await expect(
      repository.createClaim({
        id: claim.id,
        userId: "user_1",
        offerVersion: "guest_generation_v1",
        amountUsdMicros: 5_000_000,
        ticketIssuedAt: claim.ticketIssuedAt,
        ticketExpiresAt: claim.ticketExpiresAt,
      }),
    ).resolves.toEqual(claim);
    expect(mocks.insertValues).toHaveBeenCalledWith({
      id: claim.id,
      userId: "user_1",
      offerVersion: "guest_generation_v1",
      amountUsdMicros: 5_000_000,
      ticketIssuedAt: claim.ticketIssuedAt,
      ticketExpiresAt: claim.ticketExpiresAt,
    });
  });

  it.each(["promotion_claim_pkey", "promotion_claim_user_id_idx"])(
    "maps %s uniqueness violations to claim conflicts",
    async (constraint) => {
      mocks.insertError = {
        code: "23505",
        constraint_name: constraint,
      };
      const repository = new PromotionRepository();

      await expect(
        repository.createClaim({
          id: claim.id,
          userId: "user_1",
          offerVersion: "guest_generation_v1",
          amountUsdMicros: 5_000_000,
          ticketIssuedAt: claim.ticketIssuedAt,
          ticketExpiresAt: claim.ticketExpiresAt,
        }),
      ).rejects.toBeInstanceOf(PromotionClaimConflictError);
    },
  );

  it("gets claims without locking and locks redemption reads for update", async () => {
    const repository = new PromotionRepository();

    await expect(repository.getClaimByUserId("user_1")).resolves.toEqual(claim);
    expect(mocks.forUpdate).not.toHaveBeenCalled();

    await expect(repository.lockClaimByUserId("user_1")).resolves.toEqual(
      claim,
    );
    expect(mocks.forUpdate).toHaveBeenCalledWith("update");
  });

  it("marks only an unredeemed claim with both redemption fields", async () => {
    const repository = new PromotionRepository();
    const redeemedAt = new Date("2026-07-26T12:05:00.000Z");

    await repository.markClaimRedeemed({
      claimId: claim.id,
      creditLedgerEntryId: "ledger_1",
      redeemedAt,
    });

    expect(mocks.updateSet).toHaveBeenCalledWith({
      creditLedgerEntryId: "ledger_1",
      redeemedAt,
    });
    expect(mocks.and).toHaveBeenCalledTimes(1);
    expect(mocks.isNull).toHaveBeenCalledTimes(2);
  });

  it("rejects a redemption update that did not match an unredeemed claim", async () => {
    mocks.updateRows = [];
    const repository = new PromotionRepository();

    await expect(
      repository.markClaimRedeemed({
        claimId: claim.id,
        creditLedgerEntryId: "ledger_1",
        redeemedAt: new Date("2026-07-26T12:05:00.000Z"),
      }),
    ).rejects.toThrow(`Promotion claim ${claim.id} was not marked redeemed`);
  });
});

function createInsertChain() {
  return {
    values: vi.fn((values: unknown) => {
      mocks.insertValues(values);

      return {
        returning: vi.fn(async () => {
          if (mocks.insertError) {
            throw mocks.insertError;
          }

          return mocks.insertRows;
        }),
      };
    }),
  };
}

function createSelectChain(): Record<string, unknown> {
  return {
    from: vi.fn(() => createSelectChain()),
    where: vi.fn(() => createSelectChain()),
    limit: vi.fn(() => ({
      for: vi.fn(async (lock: string) => {
        mocks.forUpdate(lock);
        return mocks.selectRows;
      }),
      then: (
        resolve: (rows: unknown[]) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(mocks.selectRows).then(resolve, reject),
    })),
  };
}

function createUpdateChain() {
  return {
    set: vi.fn((values: unknown) => {
      mocks.updateSet(values);

      return {
        where: vi.fn((condition: unknown) => {
          mocks.updateWhere(condition);

          return {
            returning: vi.fn(async () => mocks.updateRows),
          };
        }),
      };
    }),
  };
}
