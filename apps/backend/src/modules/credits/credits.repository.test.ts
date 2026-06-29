import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreditsRepository } from "./credits.repository.ts";
import { CreditBalanceMutationRejectedError } from "./credits.types.ts";

const mocks = vi.hoisted(() => ({
  existingGrantRows: [] as unknown[],
  balanceRows: [] as unknown[],
  ledgerInsertError: null as unknown,
  balanceRow: {
    userId: "user_1",
    availableCreditAmountUsdMicros: 35_000_000,
    reservedCreditAmountUsdMicros: 0,
  },
  balanceUpdateRows: [] as unknown[],
  ledgerRow: {
    id: "ledger_1",
  },
  randomUUID: vi.fn(),
  userBalanceInsertValues: vi.fn(),
  userBalanceOnConflict: vi.fn(),
  balanceUpdateSet: vi.fn(),
  balanceUpdateWhere: vi.fn(),
  ledgerInsertValues: vi.fn(),
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

vi.mock("node:crypto", () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  eq: mocks.eq,
  sql: mocks.sql,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    insert: vi.fn((table: unknown) => createInsertChain(table)),
    select: vi.fn(() => createSelectChain()),
    update: vi.fn(() => createUpdateChain()),
  },
  schema: {
    userBalance: {
      userId: "user_balance.user_id",
      availableCreditAmountUsdMicros:
        "user_balance.available_credit_amount_usd_micros",
      reservedCreditAmountUsdMicros:
        "user_balance.reserved_credit_amount_usd_micros",
    },
    creditLedgerEntry: {
      id: "credit_ledger_entry.id",
      userId: "credit_ledger_entry.user_id",
      idempotencyKey: "credit_ledger_entry.idempotency_key",
      availableCreditAmountUsdMicrosAfter:
        "credit_ledger_entry.available_credit_amount_usd_micros_after",
      reservedCreditAmountUsdMicrosAfter:
        "credit_ledger_entry.reserved_credit_amount_usd_micros_after",
    },
  },
}));

describe("CreditsRepository", () => {
  beforeEach(() => {
    mocks.existingGrantRows = [];
    mocks.balanceRows = [
      {
        userId: "user_1",
        availableCreditAmountUsdMicros: 35_000_000,
        reservedCreditAmountUsdMicros: 0,
      },
    ];
    mocks.ledgerInsertError = null;
    mocks.balanceRow = {
      userId: "user_1",
      availableCreditAmountUsdMicros: 35_000_000,
      reservedCreditAmountUsdMicros: 0,
    };
    mocks.balanceUpdateRows = [mocks.balanceRow];
    mocks.ledgerRow = {
      id: "ledger_1",
    };
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValue("ledger_1");
    mocks.userBalanceInsertValues.mockClear();
    mocks.userBalanceOnConflict.mockClear();
    mocks.balanceUpdateSet.mockClear();
    mocks.balanceUpdateWhere.mockClear();
    mocks.ledgerInsertValues.mockClear();
    mocks.and.mockClear();
    mocks.eq.mockClear();
    mocks.sql.mockClear();
  });

  it("creates zeroed user balances idempotently", async () => {
    const repository = new CreditsRepository();

    await repository.createUserBalance({ userId: "user_1" });

    expect(mocks.userBalanceInsertValues).toHaveBeenCalledWith({
      userId: "user_1",
      availableCreditAmountUsdMicros: 0,
      reservedCreditAmountUsdMicros: 0,
    });
    expect(mocks.userBalanceOnConflict).toHaveBeenCalledWith({
      target: "user_balance.user_id",
    });
  });

  it("gets user balances by user id", async () => {
    const repository = new CreditsRepository();

    await expect(repository.getBalanceByUserId("user_1")).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 35_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
  });

  it("returns null when no user balance exists", async () => {
    mocks.balanceRows = [];
    const repository = new CreditsRepository();

    await expect(repository.getBalanceByUserId("user_1")).resolves.toBeNull();
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
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
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

  it("updates credit balances by applying available and reserved deltas", async () => {
    const repository = new CreditsRepository();

    await expect(
      repository.updateCreditBalance(createCreditMutationCommand()),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 35_000_000,
      reservedCreditAmountUsdMicros: 0,
    });

    expect(mocks.userBalanceInsertValues).not.toHaveBeenCalled();
    expect(mocks.userBalanceOnConflict).not.toHaveBeenCalled();
    expect(mocks.ledgerInsertValues).not.toHaveBeenCalled();
    expect(mocks.balanceUpdateSet).toHaveBeenCalledWith({
      availableCreditAmountUsdMicros: {},
      reservedCreditAmountUsdMicros: {},
      updatedAt: expect.any(Date),
    });
    expect(mocks.and).toHaveBeenCalledWith({}, {}, {});
    expect(mocks.balanceUpdateWhere).toHaveBeenCalledWith({});
  });

  it("rejects balance updates that would violate balance guards", async () => {
    mocks.balanceUpdateRows = [];
    const repository = new CreditsRepository();

    await expect(
      repository.updateCreditBalance(
        createCreditMutationCommand({
          availableCreditDeltaUsdMicros: -50_000_000,
          reservedCreditDeltaUsdMicros: 50_000_000,
        }),
      ),
    ).rejects.toBeInstanceOf(CreditBalanceMutationRejectedError);
  });

  it("allows available balances to go negative when the command opts in", async () => {
    const repository = new CreditsRepository();

    await expect(
      repository.updateCreditBalance(
        createCreditMutationCommand({
          allowNegativeAvailableCreditBalance: true,
          availableCreditDeltaUsdMicros: -50_000_000,
          reservedCreditDeltaUsdMicros: 0,
        }),
      ),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 35_000_000,
      reservedCreditAmountUsdMicros: 0,
    });

    expect(mocks.and).toHaveBeenCalledWith({}, {});
  });

  it("creates credit ledger entries with resulting balances", async () => {
    const repository = new CreditsRepository();

    await expect(
      repository.createCreditLedgerEntry(createLedgerEntryCommand()),
    ).resolves.toEqual({
      id: "ledger_1",
    });

    expect(mocks.balanceUpdateSet).not.toHaveBeenCalled();
    expect(mocks.ledgerInsertValues).toHaveBeenCalledWith({
      id: "ledger_1",
      userId: "user_1",
      entryType: "manual_credit_purchase",
      availableCreditDeltaUsdMicros: 25_000_000,
      reservedCreditDeltaUsdMicros: -5_000_000,
      availableCreditAmountUsdMicrosAfter: 35_000_000,
      reservedCreditAmountUsdMicrosAfter: 0,
      generationJobId: "job_1",
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      stripeEventId: "evt_123",
      idempotencyKey: "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
      metadata: {
        amount_cents: 2500,
        credit_amount_usd_micros: 25_000_000,
        purchase_kind: "manual_credit_purchase",
        metadata_version: "1",
      },
    });
  });

  it("persists prepared checkout session idempotency keys", async () => {
    const repository = new CreditsRepository();

    await repository.createCreditLedgerEntry(
      createLedgerEntryCommand({
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

function createSelectChain(table?: unknown) {
  return {
    from: vi.fn((nextTable: unknown) => createSelectChain(nextTable)),
    where: vi.fn(() => createSelectChain(table)),
    limit: vi.fn(async () =>
      isUserBalanceTable(table) ? mocks.balanceRows : mocks.existingGrantRows,
    ),
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
        where: vi.fn((condition: unknown) => {
          mocks.balanceUpdateWhere(condition);

          return {
            returning: vi.fn(async () => mocks.balanceUpdateRows),
          };
        }),
      };
    }),
  };
}

function isUserBalanceTable(table: unknown) {
  return (
    typeof table === "object" &&
    table !== null &&
    "availableCreditAmountUsdMicros" in table
  );
}

function createCreditMutationCommand(
  overrides: Partial<
    Parameters<CreditsRepository["updateCreditBalance"]>[0]
  > = {},
) {
  return {
    userId: "user_1",
    entryType: "manual_credit_purchase" as const,
    availableCreditDeltaUsdMicros: 25_000_000,
    reservedCreditDeltaUsdMicros: -5_000_000,
    generationJobId: "job_1",
    stripeCheckoutSessionId: "cs_123",
    stripePaymentIntentId: "pi_123",
    stripeEventId: "evt_123",
    idempotencyKey: "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
    allowNegativeAvailableCreditBalance: false,
    metadata: {
      amount_cents: 2500,
      credit_amount_usd_micros: 25_000_000,
      purchase_kind: "manual_credit_purchase",
      metadata_version: "1",
    },
    ...overrides,
  };
}

function createLedgerEntryCommand(
  overrides: Partial<
    Parameters<CreditsRepository["createCreditLedgerEntry"]>[0]
  > = {},
) {
  return {
    ...createCreditMutationCommand(),
    availableCreditAmountUsdMicrosAfter: 35_000_000,
    reservedCreditAmountUsdMicrosAfter: 0,
    ...overrides,
  };
}

function createExistingGrantRow() {
  return {
    id: "ledger_1",
    userId: "user_1",
    availableCreditAmountUsdMicrosAfter: 25_000_000,
    reservedCreditAmountUsdMicrosAfter: 0,
  };
}
