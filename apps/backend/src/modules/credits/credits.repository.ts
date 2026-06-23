import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema } from "../../db/client.ts";
import type {
  ManualCreditPurchaseGrantCommand,
  ManualCreditPurchaseGrantRecord,
  UserCreditBalance,
} from "./credits.types.ts";

export class CreditsRepository {
  async createUserBalance({ userId }: { userId: string }): Promise<void> {
    await db
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
    const [balance] = await db
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
    const [ledgerEntry] = await db
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

  async insertManualCreditPurchaseGrant(
    input: ManualCreditPurchaseGrantCommand,
  ): Promise<ManualCreditPurchaseGrantRecord> {
    return db.transaction(async (tx) => {
      const [balance] = await tx
        .update(schema.userBalance)
        .set({
          availableCreditAmount: sql`${schema.userBalance.availableCreditAmount} + ${input.creditAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.userBalance.userId, input.userId))
        .returning({
          userId: schema.userBalance.userId,
          availableCreditAmount: schema.userBalance.availableCreditAmount,
          reservedCreditAmount: schema.userBalance.reservedCreditAmount,
        });

      if (!balance) {
        throw new Error(
          `Credit balance was not updated for user ${input.userId}`,
        );
      }

      const [ledgerEntry] = await tx
        .insert(schema.creditLedgerEntry)
        .values({
          id: randomUUID(),
          userId: input.userId,
          entryType: input.entryType,
          availableCreditDelta: input.creditAmount,
          reservedCreditDelta: 0,
          availableCreditAmountAfter: balance.availableCreditAmount,
          reservedCreditAmountAfter: balance.reservedCreditAmount,
          generationJobId: null,
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

      return {
        userId: balance.userId,
        availableCreditAmount: balance.availableCreditAmount,
        reservedCreditAmount: balance.reservedCreditAmount,
        ledgerEntryId: ledgerEntry.id,
      };
    });
  }
}

export const creditsRepository = new CreditsRepository();
