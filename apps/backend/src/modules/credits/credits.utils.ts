import { assertNever, isRecord } from "@remora/utils";

import {
  autoTopUpCreditPurchaseKind,
  generationCreditChargeKind,
  generationCreditReservationKind,
  generationCreditReservationReleaseKind,
  manualCreditPurchaseMetadataVersions,
  manualCreditPurchaseKind,
  promotionalCreditGrantKind,
  type CreditLedgerEntryMetadata,
  type GenerationCreditChargeLedgerMetadata,
  type GenerationCreditReservationLedgerMetadata,
  type GenerationCreditReservationReleaseLedgerMetadata,
  type ManualCreditPurchaseMetadataVersion,
  type PromotionalCreditGrant,
  type PromotionalCreditGrantLedgerMetadata,
  type VerifiedCreditAutoTopUpPurchase,
  type VerifiedManualCreditPurchase,
} from "./credits.types.ts";

const creditLedgerEntryIdempotencyKeyIndexName =
  "credit_ledger_entry_idempotency_key_idx";

export function isValidManualCreditPurchaseMetadataVersion(
  value: unknown,
): value is ManualCreditPurchaseMetadataVersion {
  return manualCreditPurchaseMetadataVersions.some(
    (version) => version === value,
  );
}

export function getManualCreditPurchaseGoogleAdsAttributionId(
  metadataVersion: ManualCreditPurchaseMetadataVersion,
  metadata: Record<string, string>,
) {
  switch (metadataVersion) {
    case "1":
      return null;
    case "2":
      return metadata.google_ads_attribution_id ?? null;
    default:
      return assertNever(metadataVersion);
  }
}

export function createManualCreditPurchaseIdempotencyKey({
  stripeCheckoutSessionId,
  stripePaymentIntentId,
}: Pick<
  VerifiedManualCreditPurchase,
  "stripeCheckoutSessionId" | "stripePaymentIntentId"
>) {
  if (stripePaymentIntentId) {
    return `stripe:payment_intent:${stripePaymentIntentId}:manual-credit-purchase:v1`;
  }

  return `stripe:checkout_session:${stripeCheckoutSessionId}:manual-credit-purchase:v1`;
}

export function isCreditLedgerEntryIdempotencyKeyConflict(error: unknown) {
  const visitedErrors = new Set<unknown>();
  let currentError: unknown = error;

  while (isRecord(currentError) && !visitedErrors.has(currentError)) {
    if (
      currentError.code === "23505" &&
      (currentError.constraint_name ===
        creditLedgerEntryIdempotencyKeyIndexName ||
        currentError.constraint === creditLedgerEntryIdempotencyKeyIndexName)
    ) {
      return true;
    }

    visitedErrors.add(currentError);
    currentError = currentError.cause;
  }

  return false;
}

export function createManualCreditPurchaseLedgerMetadata({
  amountCents,
  creditAmountUsdMicros,
}: Pick<
  VerifiedManualCreditPurchase,
  "amountCents" | "creditAmountUsdMicros"
>): CreditLedgerEntryMetadata {
  return {
    amount_cents: amountCents,
    credit_amount_usd_micros: creditAmountUsdMicros,
    purchase_kind: manualCreditPurchaseKind,
    metadata_version: "1",
  };
}

export function createCreditAutoTopUpPurchaseIdempotencyKey({
  stripePaymentIntentId,
}: Pick<VerifiedCreditAutoTopUpPurchase, "stripePaymentIntentId">) {
  return `stripe:payment_intent:${stripePaymentIntentId}:auto-top-up-credit-purchase:v1`;
}

export function createCreditAutoTopUpPurchaseLedgerMetadata({
  amountCents,
  creditAmountUsdMicros,
  topUpFloorUsdMicros,
  triggerLedgerEntryId,
}: Pick<
  VerifiedCreditAutoTopUpPurchase,
  | "amountCents"
  | "creditAmountUsdMicros"
  | "topUpFloorUsdMicros"
  | "triggerLedgerEntryId"
>): CreditLedgerEntryMetadata {
  return {
    amount_cents: amountCents,
    credit_amount_usd_micros: creditAmountUsdMicros,
    purchase_kind: autoTopUpCreditPurchaseKind,
    top_up_floor_usd_micros: topUpFloorUsdMicros,
    trigger_ledger_entry_id: triggerLedgerEntryId,
    metadata_version: "1",
  };
}

export function createPromotionalCreditGrantIdempotencyKey({
  offerVersion,
  userId,
}: Pick<PromotionalCreditGrant, "offerVersion" | "userId">) {
  return `promotion:user:${userId}:offer:${offerVersion}:credit-grant:v1`;
}

export function createPromotionalCreditGrantLedgerMetadata({
  amountUsdMicros,
  offerVersion,
  promotionClaimId,
}: Pick<
  PromotionalCreditGrant,
  "amountUsdMicros" | "offerVersion" | "promotionClaimId"
>): PromotionalCreditGrantLedgerMetadata {
  return {
    promotion_claim_id: promotionClaimId,
    offer_version: offerVersion,
    credit_amount_usd_micros: amountUsdMicros,
    credit_grant_kind: promotionalCreditGrantKind,
    metadata_version: "1",
  };
}

export function createGenerationCreditReservationIdempotencyKey({
  generationJobId,
}: {
  generationJobId: string;
}) {
  return `generation:job:${generationJobId}:credit-reservation:v1`;
}

export function createGenerationCreditChargeIdempotencyKey({
  generationJobId,
}: {
  generationJobId: string;
}) {
  return `generation:job:${generationJobId}:credit-charge:v1`;
}

export function createGenerationCreditReservationReleaseIdempotencyKey({
  generationJobId,
}: {
  generationJobId: string;
}) {
  return `generation:job:${generationJobId}:credit-reservation-release:v1`;
}

export function createGenerationCreditReservationLedgerMetadata({
  estimatedCostUsdMicros,
  generationJobCostId,
  generationSubmissionId,
}: {
  estimatedCostUsdMicros: number;
  generationJobCostId: string;
  generationSubmissionId: string;
}): GenerationCreditReservationLedgerMetadata {
  return {
    generation_submission_id: generationSubmissionId,
    generation_job_cost_estimate_id: generationJobCostId,
    estimated_cost_usd_micros: estimatedCostUsdMicros,
    credit_reservation_kind: generationCreditReservationKind,
    metadata_version: "1",
  };
}

export function createGenerationCreditChargeLedgerMetadata({
  estimatedCostUsdMicros,
  finalCostUsdMicros,
  generationJobCostId,
}: {
  estimatedCostUsdMicros: number;
  finalCostUsdMicros: number;
  generationJobCostId: string;
}): GenerationCreditChargeLedgerMetadata {
  return {
    generation_job_cost_id: generationJobCostId,
    estimated_cost_usd_micros: estimatedCostUsdMicros,
    final_cost_usd_micros: finalCostUsdMicros,
    credit_charge_kind: generationCreditChargeKind,
    metadata_version: "1",
  };
}

export function createGenerationCreditReservationReleaseLedgerMetadata({
  estimatedCostUsdMicros,
  generationJobCostId,
}: {
  estimatedCostUsdMicros: number;
  generationJobCostId: string;
}): GenerationCreditReservationReleaseLedgerMetadata {
  return {
    generation_job_cost_id: generationJobCostId,
    estimated_cost_usd_micros: estimatedCostUsdMicros,
    credit_reservation_release_kind: generationCreditReservationReleaseKind,
    metadata_version: "1",
  };
}
