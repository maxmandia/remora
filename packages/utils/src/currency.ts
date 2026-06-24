export const currencyAmountPattern = /^\d+(?:\.\d{0,2})?$/;
export const usdMicrosPerCent = 10_000;

const currencyAmountFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const usdMicrosCurrencyAmountFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

export function formatCurrencyAmount(amountCents: number) {
  return currencyAmountFormatter.format(amountCents / 100);
}

export function formatUsdMicrosCurrencyAmount(amountUsdMicros: number) {
  return usdMicrosCurrencyAmountFormatter.format(
    amountUsdMicros / (100 * usdMicrosPerCent),
  );
}

export function getUsdMicrosFromCents(amountCents: number) {
  return amountCents * usdMicrosPerCent;
}

export function getCurrencyAmountCents(value: string) {
  const amount = value.trim();

  if (!currencyAmountPattern.test(amount)) {
    return null;
  }

  const [dollars, cents = ""] = amount.split(".");
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));

  return amountCents > 0 ? amountCents : null;
}
