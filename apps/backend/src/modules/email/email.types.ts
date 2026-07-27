export type VerificationEmailMessage = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

export type VerificationEmailDeliveryResult = {
  providerMessageId: string | null;
  status: "delivered" | "queued";
};

export interface VerificationEmailProvider {
  deliver(
    message: VerificationEmailMessage,
  ): Promise<VerificationEmailDeliveryResult>;
}

export class VerificationEmailConfigurationError extends Error {
  constructor() {
    super("Verification email delivery is not configured.");
    this.name = "VerificationEmailConfigurationError";
  }
}

export class VerificationEmailDeliveryError extends Error {
  constructor(
    readonly kind:
      | "invalid-response"
      | "permanent-bounce"
      | "provider-error"
      | "timeout",
    readonly statusCode: number | null = null,
  ) {
    super("Verification email delivery failed.");
    this.name = "VerificationEmailDeliveryError";
  }
}
