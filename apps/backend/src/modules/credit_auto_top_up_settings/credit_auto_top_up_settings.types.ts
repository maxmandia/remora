import type { CreditAutoTopUpGrantResult } from "../credits/credits.types.ts";

export type CreditAutoTopUpSettingsRecord = {
  userId: string;
  enabled: boolean;
  topUpFloorUsdMicros: number;
  topUpAmountUsdMicros: number;
};

export type ActiveCreditAutoTopUpConfig = {
  userId: string;
  stripeCustomerId: string;
  defaultStripePaymentMethodId: string;
  topUpFloorUsdMicros: number;
  topUpAmountUsdMicros: number;
};

export type CreditAutoTopUpFailureReason = "requires_action" | "payment_failed";

export type CreditAutoTopUpResult =
  | {
      status: "skipped";
      reason: "inactive" | "balance_above_floor" | "balance_missing";
    }
  | {
      status: "succeeded";
      grant: CreditAutoTopUpGrantResult;
    }
  | {
      status: "failed";
      reason: CreditAutoTopUpFailureReason;
    };

export type CreditAutoTopUpWorkflowStarterInput = {
  userId: string;
  triggerLedgerEntryId: string;
};

export type CreditAutoTopUpWorkflowStarter = (
  input: CreditAutoTopUpWorkflowStarterInput,
) => Promise<unknown>;

export class CreditAutoTopUpSettingsNotEditableError extends Error {
  constructor(userId: string) {
    super(`Credit auto-reload settings are not editable for user ${userId}`);
    this.name = "CreditAutoTopUpSettingsNotEditableError";
  }
}
