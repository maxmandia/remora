import { parseBackendPromotionEnv } from "@remora/env";
import { randomUUID } from "node:crypto";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import { analyticsService } from "../analytics/analytics.service.ts";
import type { AnalyticsTracker } from "../analytics/analytics.types.ts";
import {
  authRepository,
  type AuthRepository,
} from "../auth/auth.repository.ts";
import {
  promotionRepository,
  type PromotionRepository,
} from "./promotion.repository.ts";
import {
  PromotionAccountIneligibleError,
  PromotionClaimNotFoundError,
  PromotionConfigurationError,
  PromotionDisabledError,
  type PromotionClaimRecord,
  type PromotionStatus,
  PromotionVerificationRequiredError,
} from "./promotion.types.ts";
import {
  createPromotionTicket,
  verifyPromotionTicket,
} from "./promotion.utils.ts";

type PromotionConfig = ReturnType<typeof parseBackendPromotionEnv>;

export class PromotionService {
  private readonly auth: AuthRepository;
  private readonly analytics: AnalyticsTracker;
  private readonly config: PromotionConfig;
  private readonly createTicketId: () => string;
  private readonly now: () => Date;
  private readonly repository: PromotionRepository;
  private readonly reportError: (message: string, error: unknown) => void;
  private readonly transactionManager: TransactionManager;

  constructor(
    repository: PromotionRepository = promotionRepository,
    options: {
      analytics?: AnalyticsTracker;
      authRepository?: AuthRepository;
      config?: PromotionConfig;
      createTicketId?: () => string;
      now?: () => Date;
      reportError?: (message: string, error: unknown) => void;
      transactionManager: TransactionManager;
    },
  ) {
    this.auth = options.authRepository ?? authRepository;
    this.analytics = options.analytics ?? analyticsService;
    this.config = options.config ?? parseBackendPromotionEnv(process.env);
    this.createTicketId = options.createTicketId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
    this.repository = repository;
    this.reportError =
      options.reportError ??
      ((message, error) => {
        console.error(message, error);
      });
    this.transactionManager = options.transactionManager;
  }

  issueTicket() {
    if (!this.config.PROMOTION_ENABLED) {
      throw new PromotionDisabledError();
    }

    const issuedAt = this.now();
    const { payload, ticket } = createPromotionTicket({
      issuedAt,
      secret: this.getSigningSecret(),
      ticketId: this.createTicketId(),
    });

    return {
      ticket,
      offerVersion: payload.offerVersion,
      amountUsdMicros: payload.amountUsdMicros,
      expiresAt: new Date(payload.expiresAtMs).toISOString(),
    };
  }

  async claim({
    ticket,
    userId,
  }: {
    ticket: string;
    userId: string;
  }): Promise<{ status: PromotionStatus }> {
    const payload = verifyPromotionTicket({
      now: this.now(),
      secret: this.getSigningSecret(),
      ticket,
    });

    return this.transactionManager.transaction(async (transaction) => {
      const user = await transaction.auth.getUserById(userId);
      const userCreatedAtMs = user?.createdAt.getTime();

      if (
        !user ||
        userCreatedAtMs === undefined ||
        userCreatedAtMs < payload.issuedAtMs ||
        userCreatedAtMs > payload.expiresAtMs
      ) {
        throw new PromotionAccountIneligibleError();
      }

      const claim = await transaction.promotion.createClaim({
        userId,
        id: payload.ticketId,
        offerVersion: payload.offerVersion,
        amountUsdMicros: payload.amountUsdMicros,
        ticketIssuedAt: new Date(payload.issuedAtMs),
        ticketExpiresAt: new Date(payload.expiresAtMs),
      });

      return {
        status: this.getClaimStatus(claim, user.emailVerified),
      };
    });
  }

  async getStatus(userId: string): Promise<{ status: PromotionStatus }> {
    const claim = await this.repository.getClaimByUserId(userId);

    if (!claim) {
      return { status: "none" };
    }

    if (claim.redeemedAt) {
      return { status: "redeemed" };
    }

    const user = await this.auth.getUserById(userId);

    if (!user) {
      throw new Error(`Promotion claim user ${userId} was not found`);
    }

    return {
      status: this.getClaimStatus(claim, user.emailVerified),
    };
  }

  async trackEmailVerified({
    occurredAt,
    userId,
  }: {
    occurredAt: Date;
    userId: string;
  }): Promise<void> {
    try {
      const claim = await this.repository.getClaimByUserId(userId);

      if (!claim) {
        return;
      }

      this.analytics.track(
        {
          type: "guest_generation_email_verified",
          userId,
          occurredAt,
          promotionClaimId: claim.id,
          offerVersion: claim.offerVersion,
        },
        { suppressed: false },
      );
    } catch (error) {
      try {
        this.reportError(
          "Guest generation verification analytics failed",
          error,
        );
      } catch {
        // Analytics and its error reporting must not interrupt verification.
      }
    }
  }

  async redeem(userId: string): Promise<{ status: "redeemed" }> {
    return this.transactionManager.transaction(async (transaction) => {
      const claim = await transaction.promotion.lockClaimByUserId(userId);

      if (!claim) {
        throw new PromotionClaimNotFoundError();
      }

      if (claim.redeemedAt) {
        return { status: "redeemed" };
      }

      const user = await transaction.auth.getUserById(userId);

      if (!user) {
        throw new PromotionClaimNotFoundError();
      }

      if (!user.emailVerified) {
        throw new PromotionVerificationRequiredError();
      }

      const grant = await transaction.services.credits.grantPromotionalCredit({
        userId,
        promotionClaimId: claim.id,
        offerVersion: claim.offerVersion,
        amountUsdMicros: claim.amountUsdMicros,
      });

      await transaction.promotion.markClaimRedeemed({
        claimId: claim.id,
        creditLedgerEntryId: grant.ledgerEntryId,
        redeemedAt: this.now(),
      });

      return { status: "redeemed" };
    });
  }

  private getClaimStatus(
    claim: PromotionClaimRecord,
    emailVerified: boolean,
  ): PromotionStatus {
    if (claim.redeemedAt) {
      return "redeemed";
    }

    return emailVerified ? "eligible" : "verification_required";
  }

  private getSigningSecret() {
    const secret = this.config.PROMOTION_TICKET_SIGNING_SECRET;

    if (!secret || secret.length < 32) {
      throw new PromotionConfigurationError();
    }

    return secret;
  }
}
