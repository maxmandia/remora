import {
  createCreditCheckoutSessionInputSchema,
  maxCreditPurchaseAmountCents,
  minCreditPurchaseAmountCents,
} from "@remora/domain/credits/validator";
import { getFormFieldA11y, useForm } from "@remora/form";
import {
  Button,
  Card,
  CurrencyInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Skeleton,
} from "@remora/ui";
import {
  currencyAmountPattern,
  formatCurrencyAmount,
  getCurrencyAmountCents,
} from "@remora/utils/currency";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SettingsLayout } from "../../layouts/settings-layout.tsx";
import { useTRPC } from "../../lib/trpc.ts";

export function CreditsSettingsRoute() {
  const trpc = useTRPC();
  const { data: balance } = useQuery(trpc.credits.getBalance.queryOptions());
  const [isBuyCreditsDialogOpen, setIsBuyCreditsDialogOpen] = useState(false);
  const createCheckoutSessionMutation = useMutation(
    trpc.credits.createCheckoutSession.mutationOptions({}),
  );
  const form = useForm({
    defaultValues: defaultCreditPurchaseFormValue,
    validators: {
      onChange: validateCreditPurchaseForm,
      onSubmit: validateCreditPurchaseForm,
    },
    onSubmit: async ({ value }) => {
      const purchaseAmountCents = getCreditPurchaseAmountCents(value);

      if (purchaseAmountCents === null) {
        return;
      }

      try {
        const { checkoutUrl } = await createCheckoutSessionMutation.mutateAsync(
          {
            amountCents: purchaseAmountCents,
          },
        );

        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
        handleBuyCreditsDialogOpenChange(false);
      } catch {
        // Keep the dialog open so the user can retry checkout.
      }
    },
  });

  function handleBuyCreditsDialogOpenChange(open: boolean) {
    if (!open) {
      form.reset(defaultCreditPurchaseFormValue);
    }

    setIsBuyCreditsDialogOpen(open);
  }

  return (
    <SettingsLayout title="Credits" description="Manage your credits.">
      <h3 className="text-secondary-foreground text-lg font-light">
        Credit Balance
      </h3>
      <p className="text-muted-foreground text-sm font-light">
        Buy credits or turn on auto-reload to continue using Remora if you hit a
        limit.
      </p>
      <Card className="my-4 flex flex-row items-center justify-between p-3">
        <div className="flex flex-col gap-1">
          {balance ? (
            <span className="text-secondary-foreground text-base font-light">
              {formatCurrencyAmount(balance.availableCreditAmount)}
            </span>
          ) : (
            <Skeleton
              aria-label="Loading credit balance"
              className="h-5 w-12"
            />
          )}
          <span className="text-secondary-foreground text-sm font-light">
            Current balance
          </span>
        </div>
        <Button onClick={() => setIsBuyCreditsDialogOpen(true)}>
          Buy Credits
        </Button>
      </Card>
      <Dialog
        open={isBuyCreditsDialogOpen}
        onOpenChange={handleBuyCreditsDialogOpenChange}
      >
        <DialogContent aria-label="Buy credits">
          <DialogHeader>
            <DialogTitle>Buy credits</DialogTitle>
            <DialogDescription>
              Select purchase amount and configure auto-reload.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field name="creditOptionId">
              {(field) => (
                <div className="flex flex-row gap-2">
                  {creditOptions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={
                        field.state.value === option.id ? "default" : "outline"
                      }
                      aria-pressed={field.state.value === option.id}
                      onClick={() => {
                        field.handleChange(option.id);

                        if (option.id !== customCreditOptionId) {
                          form.setFieldValue("customCreditAmount", "");
                        }
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Subscribe
              selector={(state) => state.values.creditOptionId}
              children={(creditOptionId) =>
                creditOptionId === customCreditOptionId ? (
                  <form.Field name="customCreditAmount">
                    {(field) => {
                      const customAmountField = getFormFieldA11y({
                        id: "custom-credit-amount",
                        errors: field.state.meta.errors,
                      });

                      return (
                        <Field
                          className="mt-4"
                          data-invalid={customAmountField.isInvalid}
                        >
                          <FieldLabel htmlFor="custom-credit-amount">
                            Custom Amount
                          </FieldLabel>
                          <CurrencyInput
                            id="custom-credit-amount"
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onValueChange={field.handleChange}
                            aria-invalid={customAmountField.isInvalid}
                            aria-describedby={customAmountField.describedBy}
                          />
                          <FieldError
                            id={customAmountField.errorId}
                            errors={customAmountField.errors}
                          />
                        </Field>
                      );
                    }}
                  </form.Field>
                ) : null
              }
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleBuyCreditsDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isPurchaseAmountValid:
                    getCreditPurchaseAmountCents(state.values) !== null,
                  isSubmitting:
                    state.isSubmitting ||
                    createCheckoutSessionMutation.isPending,
                })}
                children={({
                  canSubmit,
                  isPurchaseAmountValid,
                  isSubmitting,
                }) => (
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit || !isPurchaseAmountValid || isSubmitting
                    }
                  >
                    Continue
                  </Button>
                )}
              />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}

const customCreditOptionId = "custom";
const defaultCreditOptionId = "preset-2500";

const creditOptions = [
  { id: "preset-1000", label: "$10", amountCents: 1000 },
  { id: defaultCreditOptionId, label: "$25", amountCents: 2500 },
  { id: "preset-5000", label: "$50", amountCents: 5000 },
  { id: "preset-10000", label: "$100", amountCents: 10000 },
  { id: customCreditOptionId, label: "Other", amountCents: null },
] as const;

type CreditOptionId = (typeof creditOptions)[number]["id"];

type CreditPurchaseFormValue = {
  creditOptionId: CreditOptionId;
  customCreditAmount: string;
};

const defaultCreditPurchaseFormValue: CreditPurchaseFormValue = {
  creditOptionId: defaultCreditOptionId,
  customCreditAmount: "",
};

function getCreditOption(creditOptionId: CreditOptionId) {
  return creditOptions.find((option) => option.id === creditOptionId);
}

function getCreditPurchaseAmountCents(value: CreditPurchaseFormValue) {
  const option = getCreditOption(value.creditOptionId);
  let amountCents: number | null;

  if (!option) {
    return null;
  }

  if (option.id === customCreditOptionId) {
    amountCents = getCurrencyAmountCents(value.customCreditAmount);
  } else {
    amountCents = option.amountCents;
  }

  return createCreditCheckoutSessionInputSchema.safeParse({
    amountCents,
  }).success
    ? amountCents
    : null;
}

function validateCreditPurchaseForm({
  value,
}: {
  value: CreditPurchaseFormValue;
}) {
  const option = getCreditOption(value.creditOptionId);

  if (!option) {
    return {
      fields: {
        creditOptionId: "Select a credit amount.",
      },
    };
  }

  if (option.id !== customCreditOptionId) {
    return undefined;
  }

  if (!value.customCreditAmount.trim()) {
    return {
      fields: {
        customCreditAmount: "Enter a credit amount.",
      },
    };
  }

  if (!currencyAmountPattern.test(value.customCreditAmount.trim())) {
    return {
      fields: {
        customCreditAmount: "Enter a valid credit amount.",
      },
    };
  }

  const amountCents = getCurrencyAmountCents(value.customCreditAmount);

  if (amountCents === null) {
    return {
      fields: {
        customCreditAmount: "Enter an amount greater than $0.",
      },
    };
  }

  if (amountCents < minCreditPurchaseAmountCents) {
    return {
      fields: {
        customCreditAmount: "Enter an amount of at least $1.",
      },
    };
  }

  if (amountCents > maxCreditPurchaseAmountCents) {
    return {
      fields: {
        customCreditAmount: "Enter an amount of $10,000 or less.",
      },
    };
  }

  return undefined;
}
