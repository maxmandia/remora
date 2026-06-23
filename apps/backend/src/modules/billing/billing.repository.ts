import { eq } from "drizzle-orm";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";

export class BillingRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async getBillingProfileByUserId(userId: string) {
    const [billingProfile] = await this.executor
      .select({
        stripeCustomerId: schema.billingProfile.stripeCustomerId,
        userId: schema.billingProfile.userId,
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

  async createCreditAutoTopUpSettings({ userId }: { userId: string }) {
    const [settings] = await this.executor
      .insert(schema.creditAutoTopUpSettings)
      .values({
        userId,
        enabled: false,
        topUpFloor: 0,
        topUpAmount: 0,
      })
      .returning({
        userId: schema.creditAutoTopUpSettings.userId,
      });

    if (!settings) {
      throw new Error("Credit auto top-up settings were not created");
    }

    return settings;
  }
}

export const billingRepository = new BillingRepository();
