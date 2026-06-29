import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  createDesktopCreditCheckoutUrl,
  parseCreditCheckoutStatus,
} from "../lib/credit-checkout-redirect";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const search = Route.useSearch() as { credit_checkout?: unknown };
  const creditCheckoutStatus = parseCreditCheckoutStatus(
    search.credit_checkout,
  );
  const desktopUrl = creditCheckoutStatus
    ? createDesktopCreditCheckoutUrl({
        status: creditCheckoutStatus,
      })
    : null;

  useEffect(() => {
    if (!desktopUrl) {
      return;
    }

    window.location.assign(desktopUrl);
  }, [desktopUrl]);

  if (desktopUrl) {
    return (
      <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p>Returning to Remora...</p>
          <a
            className="border-border hover:bg-muted rounded-md border px-3 py-2 text-sm transition-colors"
            href={desktopUrl}
          >
            Open Remora
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-6">
      <p>Nothing to see here for now.</p>
    </main>
  );
}
