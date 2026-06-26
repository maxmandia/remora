import type { BillingService } from "../billing/billing.service.ts";
import { authRepository, type AuthRepository } from "./auth.repository.ts";

type AuthServiceLogger = {
  error(message: string, error?: unknown): void;
};

export class AuthService {
  constructor(
    private readonly billing: BillingService,
    private readonly repository: AuthRepository = authRepository,
  ) {}

  async initBillingForCreatedUser({
    email,
    logger,
    name,
    userId,
  }: {
    email: string;
    logger?: AuthServiceLogger;
    name: string | null;
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
