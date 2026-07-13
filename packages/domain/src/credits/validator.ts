import { z } from "zod";

export const minCreditPurchaseAmountCents = 100;
export const maxCreditPurchaseAmountCents = 1_000_000;

const creditPurchaseAmountCentsSchema = z
  .number()
  .int("Enter a whole-cent amount.")
  .min(
    minCreditPurchaseAmountCents,
    "Credit purchase amount must be at least $1.",
  )
  .max(
    maxCreditPurchaseAmountCents,
    "Credit purchase amount must be $10,000 or less.",
  );

const creditAutoTopUpFloorCentsSchema = z
  .number()
  .int("Enter a whole-cent floor amount.")
  .min(1, "Auto-reload floor amount must be greater than $0.")
  .max(
    maxCreditPurchaseAmountCents,
    "Auto-reload floor amount must be $10,000 or less.",
  );

const creditAutoReloadInputSchema = z.discriminatedUnion("enabled", [
  z.object({
    enabled: z.literal(false),
  }),
  z.object({
    enabled: z.literal(true),
    minimumBalanceCents: z
      .number()
      .int("Enter a whole-cent minimum balance.")
      .min(1, "Auto-reload minimum balance must be greater than $0.")
      .max(
        maxCreditPurchaseAmountCents,
        "Auto-reload minimum balance must be $10,000 or less.",
      ),
  }),
]);

const desktopCheckoutReturnUrlSchema = z
  .url("Desktop return URL must be a valid URL.")
  .refine((value) => {
    const match = value.match(
      /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/callbacks\/checkout\/[A-Za-z0-9_-]{43}$/,
    );

    return Boolean(match && Number(match[1]) <= 65_535);
  }, "Desktop return URL must be a one-time loopback checkout callback.");

export const createCreditCheckoutSessionInputSchema = z.object({
  amountCents: creditPurchaseAmountCentsSchema,
  autoReload: creditAutoReloadInputSchema.optional(),
  desktopReturnUrl: desktopCheckoutReturnUrlSchema.optional(),
});

export const updateCreditAutoTopUpSettingsInputSchema = z.discriminatedUnion(
  "enabled",
  [
    z.object({
      enabled: z.literal(false),
    }),
    z.object({
      enabled: z.literal(true),
      topUpFloorCents: creditAutoTopUpFloorCentsSchema,
      topUpAmountCents: creditPurchaseAmountCentsSchema,
    }),
  ],
);

export type CreateCreditCheckoutSessionInput = z.infer<
  typeof createCreditCheckoutSessionInputSchema
>;
