import { and, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import type {
  CaptureGoogleAdsClickAttributionInput,
  GoogleAdsClickAttributionRecord,
  GoogleAdsPurchaseConversionRecord,
  GoogleAdsPurchaseConversionStatus,
  PrepareGoogleAdsPurchaseConversionInput,
} from "./google_ads.types.ts";

export class GoogleAdsRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async upsertClickAttribution({
    userId,
    clickIdType,
    clickId,
    capturedAt,
    expiresAt,
  }: CaptureGoogleAdsClickAttributionInput & {
    expiresAt: Date;
  }): Promise<GoogleAdsClickAttributionRecord> {
    const [attribution] = await this.executor
      .insert(schema.googleAdsClickAttribution)
      .values({
        id: randomUUID(),
        userId,
        clickIdType,
        clickId,
        capturedAt,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          schema.googleAdsClickAttribution.userId,
          schema.googleAdsClickAttribution.clickIdType,
          schema.googleAdsClickAttribution.clickId,
        ],
        set: {
          capturedAt,
          expiresAt,
        },
      })
      .returning();

    if (!attribution) {
      throw new Error(`Google Ads attribution was not stored for ${userId}`);
    }

    return attribution;
  }

  async findLatestActiveAttribution(
    userId: string,
    occurredAt: Date,
  ): Promise<GoogleAdsClickAttributionRecord | null> {
    const [attribution] = await this.executor
      .select()
      .from(schema.googleAdsClickAttribution)
      .where(
        and(
          eq(schema.googleAdsClickAttribution.userId, userId),
          lte(schema.googleAdsClickAttribution.capturedAt, occurredAt),
          gt(schema.googleAdsClickAttribution.expiresAt, occurredAt),
        ),
      )
      .orderBy(desc(schema.googleAdsClickAttribution.capturedAt))
      .limit(1);

    return attribution ?? null;
  }

  async findAttributionById(
    attributionId: string,
  ): Promise<GoogleAdsClickAttributionRecord | null> {
    const [attribution] = await this.executor
      .select()
      .from(schema.googleAdsClickAttribution)
      .where(eq(schema.googleAdsClickAttribution.id, attributionId))
      .limit(1);

    return attribution ?? null;
  }

  async createPurchaseConversion(
    input: PrepareGoogleAdsPurchaseConversionInput & {
      status: GoogleAdsPurchaseConversionStatus;
    },
  ): Promise<GoogleAdsPurchaseConversionRecord> {
    const [conversion] = await this.executor
      .insert(schema.googleAdsPurchaseConversion)
      .values({
        transactionId: input.transactionId,
        userId: input.userId,
        attributionId: input.attributionId,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        creditLedgerEntryId: input.creditLedgerEntryId,
        eventOccurredAt: input.eventOccurredAt,
        status: input.status,
      })
      .onConflictDoNothing({
        target: schema.googleAdsPurchaseConversion.transactionId,
      })
      .returning();

    if (conversion) {
      return conversion;
    }

    const existing = await this.findPurchaseConversionByTransactionId(
      input.transactionId,
    );

    if (!existing) {
      throw new Error(
        `Google Ads conversion ${input.transactionId} was not created`,
      );
    }

    return existing;
  }

  async findPurchaseConversionByTransactionId(
    transactionId: string,
  ): Promise<GoogleAdsPurchaseConversionRecord | null> {
    const [conversion] = await this.executor
      .select()
      .from(schema.googleAdsPurchaseConversion)
      .where(
        eq(schema.googleAdsPurchaseConversion.transactionId, transactionId),
      )
      .limit(1);

    return conversion ?? null;
  }

  async findPurchaseConversionForDelivery(transactionId: string): Promise<{
    conversion: GoogleAdsPurchaseConversionRecord;
    creditAmountUsdMicros: number;
  } | null> {
    const row = await this.executor.query.googleAdsPurchaseConversion.findFirst(
      {
        where: eq(
          schema.googleAdsPurchaseConversion.transactionId,
          transactionId,
        ),
        with: {
          creditLedgerEntry: {
            columns: {
              availableCreditDeltaUsdMicros: true,
            },
          },
        },
      },
    );

    if (!row) {
      return null;
    }

    const { creditLedgerEntry, ...conversion } = row;
    return {
      conversion,
      creditAmountUsdMicros: creditLedgerEntry.availableCreditDeltaUsdMicros,
    };
  }

  async deleteExpiredAttributions(expiredBefore: Date): Promise<number> {
    const deleted = await this.executor
      .delete(schema.googleAdsClickAttribution)
      .where(lte(schema.googleAdsClickAttribution.expiresAt, expiredBefore))
      .returning({ id: schema.googleAdsClickAttribution.id });

    return deleted.length;
  }

  async updatePurchaseConversion(
    transactionId: string,
    values: Partial<{
      status: GoogleAdsPurchaseConversionStatus;
      googleRequestId: string | null;
    }>,
  ): Promise<void> {
    const [conversion] = await this.executor
      .update(schema.googleAdsPurchaseConversion)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.googleAdsPurchaseConversion.transactionId, transactionId),
          inArray(schema.googleAdsPurchaseConversion.status, [
            "pending",
            "accepted",
            "processing",
          ]),
        ),
      )
      .returning({
        transactionId: schema.googleAdsPurchaseConversion.transactionId,
      });

    if (!conversion) {
      const existing =
        await this.findPurchaseConversionByTransactionId(transactionId);

      if (
        !existing ||
        !["succeeded", "failed", "timed_out"].includes(existing.status)
      ) {
        throw new Error(
          `Google Ads conversion ${transactionId} was not updated`,
        );
      }
    }
  }
}

export const googleAdsRepository = new GoogleAdsRepository();
