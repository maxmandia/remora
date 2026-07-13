import type { BillingService } from "../billing/billing.service.ts";
import { analyticsService } from "../analytics/analytics.service.ts";
import type { AnalyticsTracker } from "../analytics/analytics.types.ts";
import { authRepository, type AuthRepository } from "./auth.repository.ts";

type AuthServiceLogger = {
  error(message: string, error?: unknown): void;
};

export class AuthService {
  constructor(
    private readonly billing: BillingService,
    private readonly repository: AuthRepository = authRepository,
    private readonly analytics: AnalyticsTracker = analyticsService,
  ) {}

  async initBillingForCreatedUser({
    email,
    logger,
    name,
    occurredAt,
    userId,
  }: {
    email: string;
    logger?: AuthServiceLogger;
    name: string | null;
    occurredAt: Date;
    userId: string;
  }) {
    try {
      await this.billing.initBillingForNewUser({
        email,
        name,
        userId,
      });
    } catch (error) {
      await this.deleteCreatedUserAfterBillingFailure({
        error,
        logger,
        userId,
      });

      throw error;
    }

    this.analytics.track({
      type: "account_signed_up",
      userId,
      occurredAt,
    });
  }

  private async deleteCreatedUserAfterBillingFailure({
    error,
    logger,
    userId,
  }: {
    error: unknown;
    logger?: AuthServiceLogger;
    userId: string;
  }) {
    try {
      await this.repository.deleteUserById(userId);
    } catch (cleanupError) {
      logger?.error(
        `Failed to delete user ${userId} after billing profile creation failed`,
        cleanupError,
      );

      throw new Error(
        `Failed to clean up user ${userId} after billing profile creation failed`,
        {
          cause: {
            cleanupError,
            originalError: error,
          },
        },
      );
    }
  }
}
