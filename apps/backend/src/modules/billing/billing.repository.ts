import { eq } from "drizzle-orm";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import type {
  BillingPaymentMethodStatus,
  BillingProfile,
} from "./billing.types.ts";

export class BillingRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async getBillingProfileByUserId(
    userId: string,
  ): Promise<BillingProfile | null> {
    const [billingProfile] = await this.executor
      .select({
        stripeCustomerId: schema.billingProfile.stripeCustomerId,
        userId: schema.billingProfile.userId,
        defaultStripePaymentMethodId:
          schema.billingProfile.defaultStripePaymentMethodId,
        offSessionPaymentsEnabled:
          schema.billingProfile.offSessionPaymentsEnabled,
        offSessionConsentAt: schema.billingProfile.offSessionConsentAt,
        paymentMethodStatus: schema.billingProfile.paymentMethodStatus,
      })
      .from(schema.billingProfile)
      .where(eq(schema.billingProfile.userId, userId))
      .limit(1);

    return billingProfile ?? null;
  }

  async createBillingProfile({
    stripeCustomerId,
    userId,
  }: {
    stripeCustomerId: string;
    userId: string;
  }) {
    const [billingProfile] = await this.executor
      .insert(schema.billingProfile)
      .values({
        userId,
        stripeCustomerId,
        defaultStripePaymentMethodId: null,
        offSessionPaymentsEnabled: false,
        offSessionConsentAt: null,
        paymentMethodStatus: "none",
      })
      .returning({
        stripeCustomerId: schema.billingProfile.stripeCustomerId,
        userId: schema.billingProfile.userId,
      });

    if (!billingProfile) {
      throw new Error("Billing profile was not created");
    }

    return billingProfile;
  }

  async saveDefaultPaymentMethodForOffSessionUse({
    defaultStripePaymentMethodId,
    offSessionConsentAt,
    userId,
  }: {
    defaultStripePaymentMethodId: string;
    offSessionConsentAt: Date;
    userId: string;
  }) {
    const [billingProfile] = await this.executor
      .update(schema.billingProfile)
      .set({
        defaultStripePaymentMethodId,
        offSessionPaymentsEnabled: true,
        offSessionConsentAt,
        paymentMethodStatus: "active",
        updatedAt: new Date(),
      })
      .where(eq(schema.billingProfile.userId, userId))
      .returning({
        userId: schema.billingProfile.userId,
      });

    if (!billingProfile) {
      throw new Error(`Billing profile was not found for user ${userId}`);
    }

    return billingProfile;
  }

  async updateBillingPaymentMethodStatus({
    paymentMethodStatus,
    userId,
  }: {
    paymentMethodStatus: BillingPaymentMethodStatus;
    userId: string;
  }) {
    const [billingProfile] = await this.executor
      .update(schema.billingProfile)
      .set({
        paymentMethodStatus,
        offSessionPaymentsEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.billingProfile.userId, userId))
      .returning({
        userId: schema.billingProfile.userId,
      });

    if (!billingProfile) {
      throw new Error(`Billing profile was not found for user ${userId}`);
    }

    return billingProfile;
  }
}

export const billingRepository = new BillingRepository();
