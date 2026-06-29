import { isRecord } from "@remora/utils";

import {
  autoTopUpCreditPurchaseKind,
  generationCreditChargeKind,
  generationCreditReservationKind,
  generationCreditReservationReleaseKind,
  manualCreditPurchaseKind,
  type CreditLedgerEntryMetadata,
  type GenerationCreditChargeLedgerMetadata,
  type GenerationCreditReservationLedgerMetadata,
  type GenerationCreditReservationReleaseLedgerMetadata,
  type VerifiedCreditAutoTopUpPurchase,
  type VerifiedManualCreditPurchase,
} from "./credits.types.ts";

const creditLedgerEntryIdempotencyKeyIndexName =
  "credit_ledger_entry_idempotency_key_idx";

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
