import { z } from "zod";

export const minCreditPurchaseAmountCents = 100;
export const maxCreditPurchaseAmountCents = 1_000_000;

export const createCreditCheckoutSessionInputSchema = z.object({
  amountCents: z
    .number()
    .int("Enter a whole-cent amount.")
    .min(
      minCreditPurchaseAmountCents,
      "Credit purchase amount must be at least $1.",
    )
    .max(
      maxCreditPurchaseAmountCents,
      "Credit purchase amount must be $10,000 or less.",
    ),
});

export type CreateCreditCheckoutSessionInput = z.infer<
  typeof createCreditCheckoutSessionInputSchema
>;
