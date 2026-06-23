import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreditsRepository } from "./credits.repository.ts";

const mocks = vi.hoisted(() => ({
  existingGrantRows: [] as unknown[],
  ledgerInsertError: null as unknown,
  balanceRow: {
    userId: "user_1",
    availableCreditAmount: 3500,
    reservedCreditAmount: 0,
  },
  ledgerRow: {
    id: "ledger_1",
  },
  transaction: vi.fn(),
  randomUUID: vi.fn(),
  userBalanceInsertValues: vi.fn(),
  userBalanceOnConflict: vi.fn(),
  balanceUpdateSet: vi.fn(),
  ledgerInsertValues: vi.fn(),
  eq: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

vi.mock("node:crypto", () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock("drizzle-orm", () => ({
  eq: mocks.eq,
  sql: mocks.sql,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    insert: vi.fn((table: unknown) => createInsertChain(table)),
    select: vi.fn(() => createSelectChain()),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
      mocks.transaction();

      return callback(createTransaction());
    }),
  },
  schema: {
    userBalance: {
      userId: "user_balance.user_id",
      availableCreditAmount: "user_balance.available_credit_amount",
      reservedCreditAmount: "user_balance.reserved_credit_amount",
    },
    creditLedgerEntry: {
      id: "credit_ledger_entry.id",
      userId: "credit_ledger_entry.user_id",
      idempotencyKey: "credit_ledger_entry.idempotency_key",
      availableCreditAmountAfter:
        "credit_ledger_entry.available_credit_amount_after",
      reservedCreditAmountAfter:
        "credit_ledger_entry.reserved_credit_amount_after",
    },
  },
}));

describe("CreditsRepository", () => {
  beforeEach(() => {
    mocks.existingGrantRows = [];
    mocks.ledgerInsertError = null;
    mocks.balanceRow = {
      userId: "user_1",
      availableCreditAmount: 3500,
      reservedCreditAmount: 0,
    };
    mocks.ledgerRow = {
      id: "ledger_1",
    };
    mocks.transaction.mockClear();
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValue("ledger_1");
    mocks.userBalanceInsertValues.mockClear();
    mocks.userBalanceOnConflict.mockClear();
    mocks.balanceUpdateSet.mockClear();
    mocks.ledgerInsertValues.mockClear();
    mocks.eq.mockClear();
    mocks.sql.mockClear();
  });

  it("creates zeroed user balances idempotently", async () => {
    const repository = new CreditsRepository();

    await repository.createUserBalance({ userId: "user_1" });

    expect(mocks.userBalanceInsertValues).toHaveBeenCalledWith({
      userId: "user_1",
      availableCreditAmount: 0,
      reservedCreditAmount: 0,
    });
    expect(mocks.userBalanceOnConflict).toHaveBeenCalledWith({
      target: "user_balance.user_id",
    });
  });

  it("finds manual credit purchase grants by idempotency key", async () => {
    mocks.existingGrantRows = [createExistingGrantRow()];
    const repository = new CreditsRepository();

    await expect(
      repository.findManualCreditPurchaseGrantByIdempotencyKey(
        "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
      ),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmount: 2500,
      reservedCreditAmount: 0,
      ledgerEntryId: "ledger_1",
    });
  });

  it("returns null when no grant exists for an idempotency key", async () => {
    const repository = new CreditsRepository();

    await expect(
      repository.findManualCreditPurchaseGrantByIdempotencyKey(
        "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
      ),
    ).resolves.toBeNull();
  });

  it("inserts manual credit purchases atomically through balance and ledger rows", async () => {
    const repository = new CreditsRepository();

    await expect(
      repository.insertManualCreditPurchaseGrant(createGrantCommand()),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmount: 3500,
      reservedCreditAmount: 0,
      ledgerEntryId: "ledger_1",
    });

    expect(mocks.userBalanceInsertValues).not.toHaveBeenCalled();
    expect(mocks.userBalanceOnConflict).not.toHaveBeenCalled();
    expect(mocks.balanceUpdateSet).toHaveBeenCalledWith({
      availableCreditAmount: {},
      updatedAt: expect.any(Date),
    });
    expect(mocks.ledgerInsertValues).toHaveBeenCalledWith({
      id: "ledger_1",
      userId: "user_1",
      entryType: "manual_credit_purchase",
      availableCreditDelta: 2500,
      reservedCreditDelta: 0,
      availableCreditAmountAfter: 3500,
      reservedCreditAmountAfter: 0,
      generationJobId: null,
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      stripeEventId: "evt_123",
      idempotencyKey:
        "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
      metadata: {
        amount_cents: 2500,
        credit_amount: 2500,
        purchase_kind: "manual_credit_purchase",
        metadata_version: "1",
      },
    });
  });

  it("persists prepared checkout session idempotency keys", async () => {
    const repository = new CreditsRepository();

    await repository.insertManualCreditPurchaseGrant(
      createGrantCommand({
        stripePaymentIntentId: null,
        idempotencyKey:
          "stripe:checkout_session:cs_123:manual-credit-purchase:v1",
      }),
    );

    expect(mocks.ledgerInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey:
          "stripe:checkout_session:cs_123:manual-credit-purchase:v1",
      }),
    );
  });
});

function createTransaction() {
  return {
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn((table: unknown) => createInsertChain(table)),
    update: vi.fn(() => createUpdateChain()),
  };
}

function createSelectChain() {
  return {
    from: vi.fn(() => createSelectChain()),
    where: vi.fn(() => createSelectChain()),
    limit: vi.fn(async () => mocks.existingGrantRows),
  };
}

function createInsertChain(table: unknown) {
  return {
    values: vi.fn((values: unknown) => {
      if (isUserBalanceTable(table)) {
        mocks.userBalanceInsertValues(values);

        return {
          onConflictDoNothing: vi.fn(async (options: unknown) => {
            mocks.userBalanceOnConflict(options);
          }),
        };
      }

      mocks.ledgerInsertValues(values);

      return {
        returning: vi.fn(async () => {
          if (mocks.ledgerInsertError) {
            throw mocks.ledgerInsertError;
          }

          return [mocks.ledgerRow];
        }),
      };
    }),
  };
}

function createUpdateChain() {
  return {
    set: vi.fn((values: unknown) => {
      mocks.balanceUpdateSet(values);

      return {
        where: vi.fn(() => ({
          returning: vi.fn(async () => [mocks.balanceRow]),
        })),
      };
    }),
  };
}

function isUserBalanceTable(table: unknown) {
  return (
    typeof table === "object" &&
    table !== null &&
    "availableCreditAmount" in table
  );
}

function createGrantCommand(
  overrides: Partial<
    Parameters<CreditsRepository["insertManualCreditPurchaseGrant"]>[0]
  > = {},
) {
  return {
    userId: "user_1",
    entryType: "manual_credit_purchase" as const,
    creditAmount: 2500,
    stripeCheckoutSessionId: "cs_123",
    stripePaymentIntentId: "pi_123",
    stripeEventId: "evt_123",
    idempotencyKey: "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
    metadata: {
      amount_cents: 2500,
      credit_amount: 2500,
      purchase_kind: "manual_credit_purchase",
      metadata_version: "1",
    },
    ...overrides,
  };
}

function createExistingGrantRow() {
  return {
    id: "ledger_1",
    userId: "user_1",
    availableCreditAmountAfter: 2500,
    reservedCreditAmountAfter: 0,
  };
}
