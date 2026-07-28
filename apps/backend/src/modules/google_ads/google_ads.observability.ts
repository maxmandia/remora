import { logObservabilityEvent } from "../observability/observability.service.ts";
import type { LogLevel } from "../observability/observability.types.ts";

export type GoogleAdsLifecycleEvent =
  | "google_ads.attribution.captured"
  | "google_ads.conversion.prepared"
  | "google_ads.conversion.skipped"
  | "google_ads.conversion.accepted"
  | "google_ads.conversion.processing"
  | "google_ads.conversion.succeeded"
  | "google_ads.conversion.failed"
  | "google_ads.conversion.timed_out"
  | "google_ads.attribution.pruned";

export type GoogleAdsLifecycleFields = {
  attributionId?: string | null;
  clickIdType?: string | null;
  creditLedgerEntryId?: string | null;
  googleRequestId?: string | null;
  status?: string | null;
  stripeCheckoutSessionId?: string | null;
  transactionId?: string | null;
  userId?: string | null;
  errorCode?: string | null;
  warningCode?: string | null;
  deletedCount?: number | null;
};

export function logGoogleAdsLifecycleEvent(
  event: GoogleAdsLifecycleEvent,
  fields: GoogleAdsLifecycleFields = {},
): void {
  const level: LogLevel =
    event === "google_ads.conversion.failed" ||
    event === "google_ads.conversion.timed_out"
      ? "error"
      : fields.warningCode
        ? "warn"
        : "info";

  logObservabilityEvent(event, fields, { level });
}
