import { creditsSettingsPath } from "@remora/domain/credits/routes";
import { createFileRoute } from "@tanstack/react-router";

import { WebCreditsSettingsRoute } from "../components/web-credits-settings-route";
import { parseCreditCheckoutSearch } from "../lib/credit-checkout-redirect";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/app/settings/credits")({
  component: CreditsSettingsRoute,
  head: () =>
    createSeoHead({
      canonicalPath: "/app/settings/credits",
      description: "Manage your Remora credits.",
      index: false,
      title: "Credits",
    }),
  validateSearch: parseCreditCheckoutSearch,
});

export const creditsSettingsRoutePath: typeof Route.fullPath =
  creditsSettingsPath;

function CreditsSettingsRoute() {
  const navigate = Route.useNavigate();
  const checkoutSearch = Route.useSearch();

  return (
    <WebCreditsSettingsRoute
      checkoutSearch={checkoutSearch}
      onCheckoutReturnHandled={() =>
        navigate({
          replace: true,
          search: {},
          to: creditsSettingsRoutePath,
        })
      }
    />
  );
}
