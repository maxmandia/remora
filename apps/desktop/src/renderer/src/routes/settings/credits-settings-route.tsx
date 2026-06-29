import {
  createCreditCheckoutSessionInputSchema,
  maxCreditPurchaseAmountCents,
  minCreditPurchaseAmountCents,
  updateCreditAutoTopUpSettingsInputSchema,
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
  formatUsdMicrosCurrencyAmount,
  getCurrencyAmountCents,
  usdMicrosPerCent,
} from "@remora/utils/currency";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SettingsLayout } from "../../layouts/settings-layout.tsx";
import { useTRPC } from "../../lib/trpc.ts";

export function CreditsSettingsRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: balance } = useQuery(trpc.credits.getBalance.queryOptions());
  const autoReloadSettingsQueryOptions =
    trpc.creditAutoTopUpSettings.getSettings.queryOptions();
  const { data: autoReloadSettings } = useQuery(
    autoReloadSettingsQueryOptions,
  );
  const [savedAutoReloadSettings, setSavedAutoReloadSettings] =
    useState<CreditAutoTopUpSettings | null>(null);
  const savedAutoReloadSettingsRef = useRef<CreditAutoTopUpSettings | null>(
    null,
  );
  const effectiveAutoReloadSettings =
    savedAutoReloadSettings ?? autoReloadSettings;
  const autoReloadEditFormValue =
    getCreditPurchaseFormValueFromAutoReloadSettings(
      effectiveAutoReloadSettings,
    );
  const autoReloadSettingsSnapshot =
    getCreditAutoTopUpSettingsSnapshot(effectiveAutoReloadSettings);
  const isAutoReloadEditMode =
    autoReloadEditFormValue !== null && autoReloadSettingsSnapshot !== null;
  const [isBuyCreditsDialogOpen, setIsBuyCreditsDialogOpen] = useState(false);
  const hasInitializedOpenDialogRef = useRef(false);
  const createCheckoutSessionMutation = useMutation(
    trpc.credits.createCheckoutSession.mutationOptions({}),
  );
  const updateAutoReloadSettingsMutation = useMutation(
    trpc.creditAutoTopUpSettings.updateSettings.mutationOptions({}),
  );
  const form = useForm({
    defaultValues: defaultCreditPurchaseFormValue,
    validators: {
      onChange: validateCreditPurchaseForm,
      onSubmit: validateCreditPurchaseForm,
    },
    onSubmit: async ({ value }) => {
      if (isAutoReloadEditMode) {
        await handleAutoReloadSettingsSubmit(value);
      } else {
        await handleCheckoutSubmit(value);
      }
    },
  });

  // Auto-reload settings may still be loading when the dialog opens, so the
  // initial reset in handleBuyCreditsDialogOpenChange can use defaults. Once
  // settings arrive, sync the form once without clobbering later user edits.
  useEffect(() => {
    if (!isBuyCreditsDialogOpen) {
      hasInitializedOpenDialogRef.current = false;
      return;
    }

    if (
      hasInitializedOpenDialogRef.current ||
      getDialogFormValue().isAutoReloadEditMode === false
    ) {
      return;
    }

    form.reset(getDialogFormValue().value);
    hasInitializedOpenDialogRef.current = true;
  }, [
    autoReloadEditFormValue,
    form,
    isBuyCreditsDialogOpen,
    savedAutoReloadSettings,
  ]);

  function handleBuyCreditsDialogOpenChange(open: boolean) {
    const dialogForm = getDialogFormValue();

    form.reset(dialogForm.value);
    hasInitializedOpenDialogRef.current = false;

    setIsBuyCreditsDialogOpen(open);
  }

  function getDialogFormValue() {
    const cachedAutoReloadSettings =
      queryClient.getQueryData<CreditAutoTopUpSettings>(
        autoReloadSettingsQueryOptions.queryKey,
      );
    const formValue = getCreditPurchaseFormValueFromAutoReloadSettings(
      savedAutoReloadSettingsRef.current ??
        cachedAutoReloadSettings ??
        effectiveAutoReloadSettings,
    );

    return {
      value: formValue ?? defaultCreditPurchaseFormValue,
      isAutoReloadEditMode: formValue !== null,
    };
  }

  async function handleAutoReloadSettingsSubmit(
    value: CreditPurchaseFormValue,
  ) {
    const updateInput = getCreditAutoTopUpSettingsUpdateInput(value);

    if (updateInput === null) {
      return;
    }

    try {
      const updatedSettings =
        await updateAutoReloadSettingsMutation.mutateAsync(updateInput);

      savedAutoReloadSettingsRef.current = updatedSettings;
      setSavedAutoReloadSettings(updatedSettings);
      queryClient.setQueryData(
        autoReloadSettingsQueryOptions.queryKey,
        updatedSettings,
      );
      await queryClient.invalidateQueries(
        trpc.creditAutoTopUpSettings.getSettings.queryFilter(),
      );
      handleBuyCreditsDialogOpenChange(false);
    } catch {
      // Keep the dialog open so the user can retry saving settings.
    }
  }

  async function handleCheckoutSubmit(value: CreditPurchaseFormValue) {
    const checkoutInput = getCreditCheckoutSessionInput(value);

    if (checkoutInput === null) {
      return;
    }

    try {
      const { checkoutUrl } =
        await createCheckoutSessionMutation.mutateAsync(checkoutInput);

      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      handleBuyCreditsDialogOpenChange(false);
    } catch {
      // Keep the dialog open so the user can retry checkout.
    }
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
              {formatUsdMicrosCurrencyAmount(
                balance.availableCreditAmountUsdMicros,
              )}
            </span>
          ) : (
            <Skeleton
              aria-label="Loading credit balance"
              className="h-5 w-12"
            />
          )}
          <div className="flex flex-row items-center gap-2">
            <span className="text-secondary-foreground text-sm font-light">
              Current balance
            </span>
            <span className="text-secondary-foreground text-sm font-light">
              •
            </span>
            <span
              onClick={() => handleBuyCreditsDialogOpenChange(true)}
              className="text-secondary-foreground cursor-pointer text-sm font-light hover:underline"
            >
              Manage auto-reload
            </span>
          </div>
        </div>
        <Button onClick={() => handleBuyCreditsDialogOpenChange(true)}>
          Buy Credits
        </Button>
      </Card>
      <Dialog
        open={isBuyCreditsDialogOpen}
        onOpenChange={handleBuyCreditsDialogOpenChange}
      >
        <DialogContent
          aria-label={isAutoReloadEditMode ? "Manage auto-reload" : "Buy credits"}
        >
          <DialogHeader>
            <DialogTitle>
              {isAutoReloadEditMode ? "Manage auto-reload" : "Buy credits"}
            </DialogTitle>
            <DialogDescription>
              {isAutoReloadEditMode
                ? "Update when Remora reloads credits."
                : "Select purchase amount and configure auto-reload."}
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {creditOptions.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      className="h-14 flex-col gap-0.5"
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
            <div className="mt-5 flex flex-col gap-3">
              <form.Field name="isAutoReloadEnabled">
                {(field) => (
                  <label
                    htmlFor="auto-reload-enabled"
                    className="flex cursor-pointer items-start gap-3"
                  >
                    <input
                      id="auto-reload-enabled"
                      name={field.name}
                      type="checkbox"
                      checked={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.checked)
                      }
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="border-input peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border text-transparent transition-colors peer-focus-visible:ring-3"
                    >
                      <CheckIcon className="size-3" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-foreground text-sm font-medium">
                        Auto-reload
                      </span>
                      <form.Subscribe
                        selector={(state) =>
                          getAutoReloadDescription(state.values)
                        }
                        children={(description) => (
                          <span className="text-muted-foreground text-sm leading-normal font-light">
                            {description}
                          </span>
                        )}
                      />
                    </span>
                  </label>
                )}
              </form.Field>
              <form.Subscribe
                selector={(state) => state.values.isAutoReloadEnabled}
                children={(isAutoReloadEnabled) =>
                  isAutoReloadEnabled ? (
                    <form.Field name="autoReloadMinimumBalance">
                      {(field) => {
                        const minimumBalanceField = getFormFieldA11y({
                          id: "auto-reload-minimum-balance",
                          errors: field.state.meta.errors,
                        });

                        return (
                          <Field data-invalid={minimumBalanceField.isInvalid}>
                            <FieldLabel htmlFor="auto-reload-minimum-balance">
                              Minimum balance
                            </FieldLabel>
                            <CurrencyInput
                              id="auto-reload-minimum-balance"
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onValueChange={field.handleChange}
                              aria-invalid={minimumBalanceField.isInvalid}
                              aria-describedby={minimumBalanceField.describedBy}
                            />
                            <FieldError
                              id={minimumBalanceField.errorId}
                              errors={minimumBalanceField.errors}
                            />
                          </Field>
                        );
                      }}
                    </form.Field>
                  ) : null
                }
              />
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleBuyCreditsDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <form.Subscribe
                selector={(state) => {
                  const updateInput = getCreditAutoTopUpSettingsUpdateInput(
                    state.values,
                  );

                  return {
                    canSubmit: state.canSubmit,
                    hasAutoReloadSettingsChanged:
                      updateInput !== null &&
                      autoReloadSettingsSnapshot !== null &&
                      hasCreditAutoTopUpSettingsChanged(
                        updateInput,
                        autoReloadSettingsSnapshot,
                      ),
                    isAutoReloadEnabled: state.values.isAutoReloadEnabled,
                    isPurchaseAmountValid:
                      getCreditPurchaseAmountCents(state.values) !== null,
                    isSubmitting:
                      state.isSubmitting ||
                      createCheckoutSessionMutation.isPending ||
                      updateAutoReloadSettingsMutation.isPending,
                  };
                }}
                children={({
                  canSubmit,
                  hasAutoReloadSettingsChanged,
                  isAutoReloadEnabled,
                  isPurchaseAmountValid,
                  isSubmitting,
                }) => (
                  <Button
                    type="submit"
                    disabled={
                      isAutoReloadEditMode
                        ? !canSubmit ||
                          !hasAutoReloadSettingsChanged ||
                          isSubmitting
                        : !canSubmit || !isPurchaseAmountValid || isSubmitting
                    }
                  >
                    {isAutoReloadEditMode
                      ? "Save"
                      : isAutoReloadEnabled
                        ? "Enable auto-reload"
                        : "Continue"}
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
  isAutoReloadEnabled: boolean;
  autoReloadMinimumBalance: string;
};

type CreditAutoTopUpSettings = {
  enabled: boolean;
  topUpFloorUsdMicros: number;
  topUpAmountUsdMicros: number;
};

type CreditAutoTopUpSettingsSnapshot = {
  topUpFloorCents: number;
  topUpAmountCents: number;
};

const defaultCreditPurchaseFormValue: CreditPurchaseFormValue = {
  creditOptionId: defaultCreditOptionId,
  customCreditAmount: "",
  isAutoReloadEnabled: false,
  autoReloadMinimumBalance: "5",
};

function getCreditOption(creditOptionId: CreditOptionId) {
  return creditOptions.find((option) => option.id === creditOptionId);
}

function getCreditOptionByAmountCents(amountCents: number) {
  return creditOptions.find((option) => option.amountCents === amountCents);
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

function getCreditPurchaseFormValueFromAutoReloadSettings(
  settings: CreditAutoTopUpSettings | undefined,
): CreditPurchaseFormValue | null {
  if (!settings?.enabled) {
    return null;
  }

  const topUpFloorCents = getCentsFromUsdMicros(
    settings.topUpFloorUsdMicros,
  );
  const topUpAmountCents = getCentsFromUsdMicros(
    settings.topUpAmountUsdMicros,
  );

  if (topUpFloorCents === null || topUpAmountCents === null) {
    return null;
  }

  const creditOption = getCreditOptionByAmountCents(topUpAmountCents);

  return {
    creditOptionId: creditOption?.id ?? customCreditOptionId,
    customCreditAmount: creditOption
      ? ""
      : formatCurrencyInputAmount(topUpAmountCents),
    isAutoReloadEnabled: true,
    autoReloadMinimumBalance: formatCurrencyInputAmount(topUpFloorCents),
  };
}

function getCreditAutoTopUpSettingsSnapshot(
  settings: CreditAutoTopUpSettings | undefined,
): CreditAutoTopUpSettingsSnapshot | null {
  if (!settings?.enabled) {
    return null;
  }

  const topUpFloorCents = getCentsFromUsdMicros(
    settings.topUpFloorUsdMicros,
  );
  const topUpAmountCents = getCentsFromUsdMicros(
    settings.topUpAmountUsdMicros,
  );

  if (topUpFloorCents === null || topUpAmountCents === null) {
    return null;
  }

  return {
    topUpFloorCents,
    topUpAmountCents,
  };
}

function getCreditAutoTopUpSettingsUpdateInput(value: CreditPurchaseFormValue) {
  if (!value.isAutoReloadEnabled) {
    const result = updateCreditAutoTopUpSettingsInputSchema.safeParse({
      enabled: false,
    });

    return result.success ? result.data : null;
  }

  const result = updateCreditAutoTopUpSettingsInputSchema.safeParse({
    enabled: true,
    topUpFloorCents: getCurrencyAmountCents(value.autoReloadMinimumBalance),
    topUpAmountCents: getCreditPurchaseAmountCents(value),
  });

  return result.success ? result.data : null;
}

function hasCreditAutoTopUpSettingsChanged(
  updateInput: NonNullable<
    ReturnType<typeof getCreditAutoTopUpSettingsUpdateInput>
  >,
  snapshot: CreditAutoTopUpSettingsSnapshot,
) {
  if (!updateInput.enabled) {
    return true;
  }

  return (
    updateInput.topUpFloorCents !== snapshot.topUpFloorCents ||
    updateInput.topUpAmountCents !== snapshot.topUpAmountCents
  );
}

function getCentsFromUsdMicros(amountUsdMicros: number) {
  if (
    !Number.isInteger(amountUsdMicros) ||
    amountUsdMicros <= 0 ||
    amountUsdMicros % usdMicrosPerCent !== 0
  ) {
    return null;
  }

  return amountUsdMicros / usdMicrosPerCent;
}

function formatCurrencyInputAmount(amountCents: number) {
  const dollars = Math.floor(amountCents / 100);
  const cents = amountCents % 100;

  return cents === 0
    ? String(dollars)
    : `${dollars}.${String(cents).padStart(2, "0")}`;
}

function getAutoReloadDescription(value: CreditPurchaseFormValue) {
  const minimumBalanceAmountCents = getCurrencyAmountCents(
    value.autoReloadMinimumBalance,
  );
  const purchaseAmountCents = getCreditPurchaseAmountCents(value);
  const minimumBalance = minimumBalanceAmountCents
    ? formatCurrencyAmount(minimumBalanceAmountCents)
    : "your minimum balance";
  const purchaseAmount = purchaseAmountCents
    ? formatCurrencyAmount(purchaseAmountCents)
    : "the selected amount";

  return `When my balance hits ${minimumBalance}, add ${purchaseAmount}.`;
}

function getCreditCheckoutSessionInput(value: CreditPurchaseFormValue) {
  const amountCents = getCreditPurchaseAmountCents(value);
  const minimumBalanceCents = getCurrencyAmountCents(
    value.autoReloadMinimumBalance,
  );

  const result = createCreditCheckoutSessionInputSchema.safeParse({
    amountCents,
    autoReload: value.isAutoReloadEnabled
      ? {
          enabled: true,
          minimumBalanceCents,
        }
      : {
          enabled: false,
        },
  });

  return result.success ? result.data : null;
}

function validateCreditPurchaseForm({
  value,
}: {
  value: CreditPurchaseFormValue;
}) {
  const option = getCreditOption(value.creditOptionId);
  const fields: Partial<Record<keyof CreditPurchaseFormValue, string>> = {};

  if (!option) {
    fields.creditOptionId = "Select a credit amount.";
  } else if (option.id === customCreditOptionId) {
    const customAmountError = validateCustomCreditAmount(
      value.customCreditAmount,
    );

    if (customAmountError) {
      fields.customCreditAmount = customAmountError;
    }
  }

  if (value.isAutoReloadEnabled) {
    const minimumBalanceError = validateAutoReloadMinimumBalance(
      value.autoReloadMinimumBalance,
    );

    if (minimumBalanceError) {
      fields.autoReloadMinimumBalance = minimumBalanceError;
    }
  }

  return Object.keys(fields).length > 0 ? { fields } : undefined;
}

function validateCustomCreditAmount(value: string) {
  if (!value.trim()) {
    return "Enter a credit amount.";
  }

  if (!currencyAmountPattern.test(value.trim())) {
    return "Enter a valid credit amount.";
  }

  const amountCents = getCurrencyAmountCents(value);

  if (amountCents === null) {
    return "Enter an amount greater than $0.";
  }

  if (amountCents < minCreditPurchaseAmountCents) {
    return "Enter an amount of at least $1.";
  }

  if (amountCents > maxCreditPurchaseAmountCents) {
    return "Enter an amount of $10,000 or less.";
  }

  return null;
}

function validateAutoReloadMinimumBalance(value: string) {
  if (!value.trim()) {
    return "Enter a minimum balance.";
  }

  if (!currencyAmountPattern.test(value.trim())) {
    return "Enter a valid minimum balance.";
  }

  const amountCents = getCurrencyAmountCents(value);

  if (amountCents === null) {
    return "Enter a minimum balance greater than $0.";
  }

  if (amountCents > maxCreditPurchaseAmountCents) {
    return "Enter a minimum balance of $10,000 or less.";
  }

  return null;
}
