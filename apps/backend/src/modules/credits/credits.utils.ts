import { isRecord } from "@remora/utils";

import {
  manualCreditPurchaseKind,
  type CreditLedgerEntryMetadata,
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
  creditAmount,
}: Pick<
  VerifiedManualCreditPurchase,
  "amountCents" | "creditAmount"
>): CreditLedgerEntryMetadata {
  return {
    amount_cents: amountCents,
    credit_amount: creditAmount,
    purchase_kind: manualCreditPurchaseKind,
    metadata_version: "1",
  };
}
