import { Button } from "@remora/ui";
import { ShieldAlertIcon } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../../providers/auth-provider.tsx";

export function ImpersonationBanner({ onStopped }: { onStopped: () => void }) {
  const { impersonatedBy, stopImpersonating, user } = useAuth();
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!impersonatedBy || !user) {
    return null;
  }

  async function stop() {
    setIsStopping(true);
    setError(null);

    try {
      await stopImpersonating();
      onStopped();
    } catch {
      setError("Unable to stop impersonating.");
    } finally {
      setIsStopping(false);
    }
  }

  return (
    <aside
      aria-label="Account impersonation"
      className="fixed top-2 left-1/2 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-400/40 bg-amber-950 px-3 py-2 text-amber-50 shadow-xl"
    >
      <ShieldAlertIcon aria-hidden="true" className="size-4 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          Impersonating {user.name || user.email}
        </p>
        <p className="truncate text-xs text-amber-200">{user.email}</p>
        {error ? (
          <p className="text-xs text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Button
        className="border-amber-300/40 text-amber-50 hover:bg-amber-900"
        disabled={isStopping}
        size="sm"
        type="button"
        variant="outline"
        onClick={() => void stop()}
      >
        {isStopping ? "Stopping..." : "Stop impersonating"}
      </Button>
    </aside>
  );
}
