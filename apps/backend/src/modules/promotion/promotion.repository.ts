import { isRecord } from "@remora/utils";
import { and, eq, isNull } from "drizzle-orm";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import {
  PromotionClaimConflictError,
  type PromotionClaimRecord,
  type PromotionOfferVersion,
} from "./promotion.types.ts";

const promotionClaimPrimaryKeyName = "promotion_claim_pkey";
const promotionClaimUserIdIndexName = "promotion_claim_user_id_idx";

export class PromotionRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async createClaim({
    amountUsdMicros,
    id,
    offerVersion,
    ticketExpiresAt,
    ticketIssuedAt,
    userId,
  }: {
    amountUsdMicros: number;
    id: string;
    offerVersion: PromotionOfferVersion;
    ticketExpiresAt: Date;
    ticketIssuedAt: Date;
    userId: string;
  }): Promise<PromotionClaimRecord> {
    try {
      const [claim] = await this.executor
        .insert(schema.promotionClaim)
        .values({
          id,
          amountUsdMicros,
          offerVersion,
          ticketExpiresAt,
          ticketIssuedAt,
          userId,
        })
        .returning();

      if (!claim) {
        throw new Error(`Promotion claim was not created for user ${userId}`);
      }

      return claim;
    } catch (error) {
      if (isPromotionClaimUniqueConflict(error)) {
        throw new PromotionClaimConflictError();
      }

      throw error;
    }
  }

  async getClaimByUserId(userId: string): Promise<PromotionClaimRecord | null> {
    const [claim] = await this.executor
      .select()
      .from(schema.promotionClaim)
      .where(eq(schema.promotionClaim.userId, userId))
      .limit(1);

    return claim ?? null;
  }

  async lockClaimByUserId(
    userId: string,
  ): Promise<PromotionClaimRecord | null> {
    const [claim] = await this.executor
      .select()
      .from(schema.promotionClaim)
      .where(eq(schema.promotionClaim.userId, userId))
      .limit(1)
      .for("update");

    return claim ?? null;
  }

  async markClaimRedeemed({
    claimId,
    creditLedgerEntryId,
    redeemedAt,
  }: {
    claimId: string;
    creditLedgerEntryId: string;
    redeemedAt: Date;
  }): Promise<void> {
    const [claim] = await this.executor
      .update(schema.promotionClaim)
      .set({
        creditLedgerEntryId,
        redeemedAt,
      })
      .where(
        and(
          eq(schema.promotionClaim.id, claimId),
          isNull(schema.promotionClaim.creditLedgerEntryId),
          isNull(schema.promotionClaim.redeemedAt),
        ),
      )
      .returning({
        id: schema.promotionClaim.id,
      });

    if (!claim) {
      throw new Error(`Promotion claim ${claimId} was not marked redeemed`);
    }
  }
}

export const promotionRepository = new PromotionRepository();

function isPromotionClaimUniqueConflict(error: unknown) {
  const visitedErrors = new Set<unknown>();
  let currentError: unknown = error;

  while (isRecord(currentError) && !visitedErrors.has(currentError)) {
    if (
      currentError.code === "23505" &&
      (currentError.constraint_name === promotionClaimPrimaryKeyName ||
        currentError.constraint === promotionClaimPrimaryKeyName ||
        currentError.constraint_name === promotionClaimUserIdIndexName ||
        currentError.constraint === promotionClaimUserIdIndexName)
    ) {
      return true;
    }

    visitedErrors.add(currentError);
    currentError = currentError.cause;
  }

  return false;
}
