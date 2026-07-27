import {
  CreditsSettingsPage,
  type CreditsSettingsCheckoutAdapter,
} from "@remora/app/credits";

export function createDesktopCreditsSettingsCheckoutAdapter({
  createCheckoutReturnUrl = () =>
    window.remoraNavigation.createCheckoutReturnUrl(),
  openCheckout = (checkoutUrl: string) =>
    window.open(checkoutUrl, "_blank", "noopener,noreferrer"),
}: {
  createCheckoutReturnUrl?: () => Promise<string | null>;
  openCheckout?: (checkoutUrl: string) => unknown;
} = {}): CreditsSettingsCheckoutAdapter {
  return {
    async getReturnInput() {
      const desktopReturnUrl = await createCheckoutReturnUrl();

      return desktopReturnUrl ? { desktopReturnUrl } : undefined;
    },
    openCheckout(checkoutUrl) {
      openCheckout(checkoutUrl);
    },
  };
}

const desktopCreditsSettingsCheckoutAdapter =
  createDesktopCreditsSettingsCheckoutAdapter();

export function CreditsSettingsRoute() {
  return (
    <CreditsSettingsPage
      checkoutAdapter={desktopCreditsSettingsCheckoutAdapter}
    />
  );
}
