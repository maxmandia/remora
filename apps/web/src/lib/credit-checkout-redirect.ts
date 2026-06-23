const defaultDesktopProtocolScheme =
  import.meta.env.VITE_DESKTOP_PROTOCOL_SCHEME ?? "app.remora.desktop";

export const creditCheckoutStatuses = ["success", "cancel"] as const;

export type CreditCheckoutStatus = (typeof creditCheckoutStatuses)[number];

export function parseCreditCheckoutStatus(value: unknown) {
  if (
    typeof value === "string" &&
    creditCheckoutStatuses.includes(value as CreditCheckoutStatus)
  ) {
    return value as CreditCheckoutStatus;
  }

  return null;
}

export function createDesktopCreditCheckoutUrl({
  protocolScheme = defaultDesktopProtocolScheme,
  status,
}: {
  protocolScheme?: string;
  status: CreditCheckoutStatus;
}) {
  const url = new URL(`${protocolScheme}://app/settings/credits`);

  url.searchParams.set("credit_checkout", status);

  return url.toString();
}
