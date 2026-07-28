import type { AnalyticsDeliveryContext } from "../analytics/analytics.types.ts";

export const googleAdsClickIdTypes = ["gclid", "gbraid", "wbraid"] as const;
export type GoogleAdsClickIdType = (typeof googleAdsClickIdTypes)[number];

export const googleAdsPurchaseConversionStatuses = [
  "skipped",
  "pending",
  "accepted",
  "processing",
  "succeeded",
  "failed",
  "timed_out",
] as const;
export type GoogleAdsPurchaseConversionStatus =
  (typeof googleAdsPurchaseConversionStatuses)[number];

export const googleAdsAttributionLifetimeMs = 90 * 24 * 60 * 60 * 1_000;

export type GoogleAdsClickAttributionRecord = {
  id: string;
  userId: string;
  clickIdType: GoogleAdsClickIdType;
  clickId: string;
  capturedAt: Date;
  expiresAt: Date;
  createdAt: Date;
};

export type GoogleAdsPurchaseConversionRecord = {
  transactionId: string;
  userId: string;
  attributionId: string | null;
  stripeCheckoutSessionId: string;
  creditLedgerEntryId: string;
  eventOccurredAt: Date;
  status: GoogleAdsPurchaseConversionStatus;
  googleRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CaptureGoogleAdsClickAttributionInput = {
  userId: string;
  clickIdType: GoogleAdsClickIdType;
  clickId: string;
  capturedAt: Date;
};

export type PrepareGoogleAdsPurchaseConversionInput = {
  analyticsContext: AnalyticsDeliveryContext;
  attributionId: string | null;
  creditLedgerEntryId: string;
  eventOccurredAt: Date;
  stripeCheckoutSessionId: string;
  transactionId: string;
  userId: string;
};

export type GoogleAdsPurchaseConversionDeliveryInput = {
  transactionId: string;
  eventOccurredAt: Date;
  creditAmountUsdMicros: number;
  clickIdType: GoogleAdsClickIdType;
  clickId: string;
};

export type GoogleAdsDataManagerRequestStatus =
  | {
      status: "processing";
    }
  | {
      status: "succeeded";
      warningCodes: string[];
    }
  | {
      status: "failed";
      errorCodes: string[];
      warningCodes: string[];
    };

export type GoogleAdsDataManagerClient = {
  ingestPurchaseConversion(
    input: GoogleAdsPurchaseConversionDeliveryInput,
  ): Promise<
    | { validatedOnly: true; requestId: null }
    | { validatedOnly: false; requestId: string }
  >;
  getRequestStatus(
    requestId: string,
  ): Promise<GoogleAdsDataManagerRequestStatus>;
};

export class GoogleAdsAttributionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAdsAttributionValidationError";
  }
}

export class GoogleAdsConversionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAdsConversionConfigurationError";
  }
}
