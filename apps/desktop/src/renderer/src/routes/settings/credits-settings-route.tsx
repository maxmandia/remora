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
} from "@remora/ui";
import { useState } from "react";

import { SettingsLayout } from "../../layouts/settings-layout.tsx";

export function CreditsSettingsRoute() {
  const [isBuyCreditsDialogOpen, setIsBuyCreditsDialogOpen] = useState(false);
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

      // TODO: Send purchaseAmountCents to the checkout mutation once Stripe is wired.
      void purchaseAmountCents;
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
          <span className="text-secondary-foreground text-base font-light">
            $0
          </span>
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
                  isSubmitting: state.isSubmitting,
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
                    Submit
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

const currencyAmountPattern = /^\d+(?:\.\d{0,2})?$/;

function getCreditOption(creditOptionId: CreditOptionId) {
  return creditOptions.find((option) => option.id === creditOptionId);
}

function getCurrencyAmountCents(value: string) {
  const amount = value.trim();

  if (!currencyAmountPattern.test(amount)) {
    return null;
  }

  const [dollars, cents = ""] = amount.split(".");
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));

  return amountCents > 0 ? amountCents : null;
}

function getCreditPurchaseAmountCents(value: CreditPurchaseFormValue) {
  const option = getCreditOption(value.creditOptionId);

  if (!option) {
    return null;
  }

  if (option.id === customCreditOptionId) {
    return getCurrencyAmountCents(value.customCreditAmount);
  }

  return option.amountCents;
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

  if (getCurrencyAmountCents(value.customCreditAmount) === null) {
    return {
      fields: {
        customCreditAmount: "Enter an amount greater than $0.",
      },
    };
  }

  return undefined;
}
