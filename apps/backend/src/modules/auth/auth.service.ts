import type { BillingService } from "../billing/billing.service.ts";
import { analyticsService } from "../analytics/analytics.service.ts";
import type { AnalyticsTracker } from "../analytics/analytics.types.ts";
import { notificationService } from "../notification/notification.service.ts";
import type { NotificationPublisher } from "../notification/notification.types.ts";
import { authRepository, type AuthRepository } from "./auth.repository.ts";

type AuthServiceLogger = {
  error(message: string, error?: unknown): void;
};

export class AuthService {
  private readonly analytics: AnalyticsTracker;
  private readonly notifications: NotificationPublisher;
  private readonly repository: AuthRepository;

  constructor(
    private readonly billing: BillingService,
    options: {
      analytics?: AnalyticsTracker;
      notifications?: NotificationPublisher;
      repository?: AuthRepository;
    } = {},
  ) {
    this.analytics = options.analytics ?? analyticsService;
    this.notifications = options.notifications ?? notificationService;
    this.repository = options.repository ?? authRepository;
  }

  async completeSignup({
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

    try {
      this.notifications.notifyAccountSignedUp({
        email,
        name,
        occurredAt,
        userId,
      });
    } catch (error) {
      try {
        logger?.error(
          `Failed to dispatch signup notification for user ${userId}`,
          error,
        );
      } catch {
        // Signup notifications and their error reporting are best-effort.
      }
    }
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
