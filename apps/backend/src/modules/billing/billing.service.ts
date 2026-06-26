import {
  getStripeClient,
  type StripeCustomerClient,
} from "../../clients/stripe/stripe.ts";
import {
  creditsRepository,
  type CreditsRepository,
} from "../credits/credits.repository.ts";
import {
  billingRepository,
  type BillingRepository,
} from "./billing.repository.ts";

export class BillingService {
  private readonly stripeCustomerClient: StripeCustomerClient | null;
  private readonly credits: CreditsRepository;

  constructor(
    private readonly repository: BillingRepository = billingRepository,
    options: {
      creditsRepository?: CreditsRepository;
      stripeCustomerClient?: StripeCustomerClient;
    } = {},
  ) {
    this.credits = options.creditsRepository ?? creditsRepository;
    this.stripeCustomerClient = options.stripeCustomerClient ?? null;
  }

  async initBillingForNewUser(input: {
    email: string;
    name: string | null;
    userId: string;
  }) {
    const stripeCustomer = await this.createStripeCustomer(input);

    try {
      const billingProfile = await this.repository.createBillingProfile({
        userId: input.userId,
        stripeCustomerId: stripeCustomer.id,
      });

      await this.repository.createCreditAutoTopUpSettings({
        userId: input.userId,
      });

      await this.credits.createUserBalance({
        userId: input.userId,
      });

      return billingProfile;
    } catch (error) {
      await this.deleteStripeCustomer(stripeCustomer.id, error);
      throw error;
    }
  }

  private async createStripeCustomer({
    email,
    name,
    userId,
  }: {
    email: string;
    name: string | null;
    userId: string;
  }) {
    const stripeCustomerClient = this.getStripeCustomerClient();
    return stripeCustomerClient.create(
      {
        email,
        ...(name ? { name } : {}),
        metadata: {
          remora_user_id: userId,
        },
      },
      {
        idempotencyKey: this.createStripeCustomerIdempotencyKey(userId),
      },
    );
  }

  private getStripeCustomerClient() {
    return this.stripeCustomerClient ?? getStripeClient().customers;
  }

  private createStripeCustomerIdempotencyKey(userId: string) {
    return `remora:user:${userId}:stripe-customer:create:v1`;
  }

  private async deleteStripeCustomer(
    stripeCustomerId: string,
    originalError: unknown,
  ) {
    try {
      await this.getStripeCustomerClient().del(stripeCustomerId);
    } catch (cleanupError) {
      throw new Error(
        `Failed to delete Stripe customer ${stripeCustomerId} after billing profile creation failed`,
        {
          cause: {
            cleanupError,
            originalError,
          },
        },
      );
    }
  }
}
