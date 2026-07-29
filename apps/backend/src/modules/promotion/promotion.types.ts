export const promotionOfferVersions = [
  "guest_generation_v1",
  "guest_generation_v2",
] as const;
export type PromotionOfferVersion = (typeof promotionOfferVersions)[number];

export const promotionOffers = {
  guest_generation_v1: {
    amountUsdMicros: 5_000_000,
  },
  guest_generation_v2: {
    amountUsdMicros: 1_000_000,
  },
} as const satisfies Record<
  PromotionOfferVersion,
  {
    amountUsdMicros: number;
  }
>;

export const guestGenerationPromotionOfferVersion = promotionOfferVersions[1];
export const guestGenerationPromotionAmountUsdMicros =
  promotionOffers[guestGenerationPromotionOfferVersion].amountUsdMicros;
export const guestGenerationPromotionTicketLifetimeMs = 24 * 60 * 60 * 1000;
export const promotionTicketSchemaVersion = 1;

export const promotionStatuses = [
  "none",
  "verification_required",
  "eligible",
  "redeemed",
] as const;
export type PromotionStatus = (typeof promotionStatuses)[number];

export type PromotionTicketPayload = {
  schemaVersion: typeof promotionTicketSchemaVersion;
  ticketId: string;
  offerVersion: PromotionOfferVersion;
  amountUsdMicros: number;
  issuedAtMs: number;
  expiresAtMs: number;
};

export type PromotionClaimRecord = {
  id: string;
  userId: string;
  offerVersion: PromotionOfferVersion;
  amountUsdMicros: number;
  ticketIssuedAt: Date;
  ticketExpiresAt: Date;
  createdAt: Date;
  redeemedAt: Date | null;
  creditLedgerEntryId: string | null;
};

export class PromotionDisabledError extends Error {
  constructor() {
    super("Promotion ticket issuance is disabled.");
    this.name = "PromotionDisabledError";
  }
}

export class PromotionConfigurationError extends Error {
  constructor() {
    super("Promotion ticket signing is not configured.");
    this.name = "PromotionConfigurationError";
  }
}

export class InvalidPromotionTicketError extends Error {
  constructor() {
    super("Promotion ticket is invalid or expired.");
    this.name = "InvalidPromotionTicketError";
  }
}

export class PromotionAccountIneligibleError extends Error {
  constructor() {
    super("The authenticated account is not eligible for this promotion.");
    this.name = "PromotionAccountIneligibleError";
  }
}

export class PromotionClaimConflictError extends Error {
  constructor() {
    super("The promotion ticket or authenticated account is already claimed.");
    this.name = "PromotionClaimConflictError";
  }
}

export class PromotionClaimNotFoundError extends Error {
  constructor() {
    super("No promotion claim exists for the authenticated account.");
    this.name = "PromotionClaimNotFoundError";
  }
}

export class PromotionVerificationRequiredError extends Error {
  constructor() {
    super("Email verification is required to redeem this promotion.");
    this.name = "PromotionVerificationRequiredError";
  }
}
