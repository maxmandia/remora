import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import { CreditBalanceMutationRejectedError } from "./credits.types.ts";
import type {
  CreditLedgerEntryCreateCommand,
  CreditMutationCommand,
  ManualCreditPurchaseGrantRecord,
  UserCreditBalance,
} from "./credits.types.ts";

export class CreditsRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async createUserBalance({ userId }: { userId: string }): Promise<void> {
    await this.executor
      .insert(schema.userBalance)
      .values({
        userId,
        availableCreditAmountUsdMicros: 0,
        reservedCreditAmountUsdMicros: 0,
      })
      .onConflictDoNothing({
        target: schema.userBalance.userId,
      });
  }

  async getBalanceByUserId(userId: string): Promise<UserCreditBalance | null> {
    const [balance] = await this.executor
      .select({
        userId: schema.userBalance.userId,
        availableCreditAmountUsdMicros:
          schema.userBalance.availableCreditAmountUsdMicros,
        reservedCreditAmountUsdMicros:
          schema.userBalance.reservedCreditAmountUsdMicros,
      })
      .from(schema.userBalance)
      .where(eq(schema.userBalance.userId, userId))
      .limit(1);

    return balance ?? null;
  }

  async findManualCreditPurchaseGrantByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ManualCreditPurchaseGrantRecord | null> {
    const [ledgerEntry] = await this.executor
      .select()
      .from(schema.creditLedgerEntry)
      .where(eq(schema.creditLedgerEntry.idempotencyKey, idempotencyKey))
      .limit(1);

    if (!ledgerEntry) {
      return null;
    }

    return {
      userId: ledgerEntry.userId,
      availableCreditAmountUsdMicros:
        ledgerEntry.availableCreditAmountUsdMicrosAfter,
      reservedCreditAmountUsdMicros:
        ledgerEntry.reservedCreditAmountUsdMicrosAfter,
      ledgerEntryId: ledgerEntry.id,
    };
  }

  async updateCreditBalance(
    input: CreditMutationCommand,
  ): Promise<UserCreditBalance> {
    const [balance] = await this.executor
      .update(schema.userBalance)
      .set({
        availableCreditAmountUsdMicros: sql`${schema.userBalance.availableCreditAmountUsdMicros} + ${input.availableCreditDeltaUsdMicros}`,
        reservedCreditAmountUsdMicros: sql`${schema.userBalance.reservedCreditAmountUsdMicros} + ${input.reservedCreditDeltaUsdMicros}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.userBalance.userId, input.userId),
          sql`${schema.userBalance.availableCreditAmountUsdMicros} + ${input.availableCreditDeltaUsdMicros} >= 0`,
          sql`${schema.userBalance.reservedCreditAmountUsdMicros} + ${input.reservedCreditDeltaUsdMicros} >= 0`,
        ),
      )
      .returning({
        userId: schema.userBalance.userId,
        availableCreditAmountUsdMicros:
          schema.userBalance.availableCreditAmountUsdMicros,
        reservedCreditAmountUsdMicros:
          schema.userBalance.reservedCreditAmountUsdMicros,
      });

    if (!balance) {
      throw new CreditBalanceMutationRejectedError(input.userId);
    }

    return balance;
  }

  async createCreditLedgerEntry(
    input: CreditLedgerEntryCreateCommand,
  ): Promise<{ id: string }> {
    const [ledgerEntry] = await this.executor
      .insert(schema.creditLedgerEntry)
      .values({
        id: randomUUID(),
        userId: input.userId,
        entryType: input.entryType,
        availableCreditDeltaUsdMicros: input.availableCreditDeltaUsdMicros,
        reservedCreditDeltaUsdMicros: input.reservedCreditDeltaUsdMicros,
        availableCreditAmountUsdMicrosAfter:
          input.availableCreditAmountUsdMicrosAfter,
        reservedCreditAmountUsdMicrosAfter:
          input.reservedCreditAmountUsdMicrosAfter,
        generationJobId: input.generationJobId,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        stripeEventId: input.stripeEventId,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      })
      .returning({
        id: schema.creditLedgerEntry.id,
      });

    if (!ledgerEntry) {
      throw new Error(
        `Credit ledger entry was not created for user ${input.userId}`,
      );
    }

    return ledgerEntry;
  }
}

export const creditsRepository = new CreditsRepository();
