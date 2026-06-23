import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
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
        availableCreditAmount: 0,
        reservedCreditAmount: 0,
      })
      .onConflictDoNothing({
        target: schema.userBalance.userId,
      });
  }

  async getBalanceByUserId(userId: string): Promise<UserCreditBalance | null> {
    const [balance] = await this.executor
      .select({
        userId: schema.userBalance.userId,
        availableCreditAmount: schema.userBalance.availableCreditAmount,
        reservedCreditAmount: schema.userBalance.reservedCreditAmount,
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
      availableCreditAmount: ledgerEntry.availableCreditAmountAfter,
      reservedCreditAmount: ledgerEntry.reservedCreditAmountAfter,
      ledgerEntryId: ledgerEntry.id,
    };
  }

  async updateCreditBalance(
    input: CreditMutationCommand,
  ): Promise<UserCreditBalance> {
    const [balance] = await this.executor
      .update(schema.userBalance)
      .set({
        availableCreditAmount: sql`${schema.userBalance.availableCreditAmount} + ${input.availableCreditDelta}`,
        reservedCreditAmount: sql`${schema.userBalance.reservedCreditAmount} + ${input.reservedCreditDelta}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.userBalance.userId, input.userId))
      .returning({
        userId: schema.userBalance.userId,
        availableCreditAmount: schema.userBalance.availableCreditAmount,
        reservedCreditAmount: schema.userBalance.reservedCreditAmount,
      });

    if (!balance) {
      throw new Error(`Credit balance was not updated for user ${input.userId}`);
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
        availableCreditDelta: input.availableCreditDelta,
        reservedCreditDelta: input.reservedCreditDelta,
        availableCreditAmountAfter: input.availableCreditAmountAfter,
        reservedCreditAmountAfter: input.reservedCreditAmountAfter,
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
