import type { EmailService } from "../email/email.service.ts";
import type { PromotionService } from "../promotion/promotion.service.ts";

export class AuthEmailVerificationService {
  constructor(
    private readonly promotion: PromotionService,
    private readonly email: EmailService,
  ) {}

  async authorizeSend({
    callbackUrl,
    expectedCallbackUrl,
    requestedEmail,
    sessionEmail,
    userId,
  }: {
    callbackUrl: unknown;
    expectedCallbackUrl: string;
    requestedEmail: unknown;
    sessionEmail: string;
    userId: string;
  }) {
    if (
      callbackUrl !== expectedCallbackUrl ||
      typeof requestedEmail !== "string" ||
      requestedEmail.toLowerCase() !== sessionEmail.toLowerCase()
    ) {
      throw new GuestVerificationEmailNotAllowedError();
    }

    const promotion = await this.promotion.getStatus(userId);

    if (promotion.status !== "verification_required") {
      throw new GuestVerificationEmailNotAllowedError();
    }
  }

  send({ email, verificationUrl }: { email: string; verificationUrl: string }) {
    return this.email.sendVerificationEmail({
      email,
      verificationUrl,
    });
  }
}

export class GuestVerificationEmailNotAllowedError extends Error {
  constructor() {
    super("Verification email is not available for this account.");
    this.name = "GuestVerificationEmailNotAllowedError";
  }
}
