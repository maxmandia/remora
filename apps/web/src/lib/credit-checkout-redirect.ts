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
  protocolScheme,
  status,
}: {
  protocolScheme?: string;
  status: CreditCheckoutStatus;
}) {
  const url = new URL(
    `${protocolScheme ?? getDefaultDesktopProtocolScheme()}://app/settings/credits`,
  );

  url.searchParams.set("credit_checkout", status);

  return url.toString();
}

function getDefaultDesktopProtocolScheme() {
  const scheme = import.meta.env.VITE_DESKTOP_PROTOCOL_SCHEME;

  if (!scheme) {
    throw new Error("VITE_DESKTOP_PROTOCOL_SCHEME is required.");
  }

  return scheme;
}
