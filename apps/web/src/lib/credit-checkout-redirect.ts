export const creditCheckoutStatuses = ["success", "cancel"] as const;

export type CreditCheckoutStatus = (typeof creditCheckoutStatuses)[number];

export type CreditCheckoutSearch = {
  checkout_session_id?: string;
  credit_checkout?: CreditCheckoutStatus;
};

export function parseStripeCheckoutSessionId(value: unknown) {
  if (
    typeof value === "string" &&
    value.length <= 255 &&
    /^cs_[A-Za-z0-9_]+$/.test(value)
  ) {
    return value;
  }

  return null;
}

export function parseCreditCheckoutStatus(value: unknown) {
  if (
    typeof value === "string" &&
    creditCheckoutStatuses.includes(value as CreditCheckoutStatus)
  ) {
    return value as CreditCheckoutStatus;
  }

  return null;
}

export function parseCreditCheckoutSearch(
  search: Record<string, unknown>,
): CreditCheckoutSearch {
  const creditCheckoutStatus = parseCreditCheckoutStatus(
    search.credit_checkout,
  );
  const stripeCheckoutSessionId = parseStripeCheckoutSessionId(
    search.checkout_session_id,
  );

  if (!creditCheckoutStatus) {
    return {};
  }

  return {
    credit_checkout: creditCheckoutStatus,
    ...(creditCheckoutStatus === "success" && stripeCheckoutSessionId
      ? { checkout_session_id: stripeCheckoutSessionId }
      : {}),
  };
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
