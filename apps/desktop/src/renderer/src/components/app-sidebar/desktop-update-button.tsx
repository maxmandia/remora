import { Button } from "@remora/ui";

import { useDesktopUpdate } from "../../hooks/use-desktop-update.ts";

export function DesktopUpdateButton() {
  const { installReadyUpdate, state } = useDesktopUpdate();

  if (state.status !== "ready") {
    return null;
  }

  function handleInstallReadyUpdate() {
    void installReadyUpdate();
  }

  return (
    <Button
      aria-label="Update Ready"
      type="button"
      size="xs"
      className="text-foreground ml-auto h-[20px] shrink-0 rounded-full bg-[#007BFE] text-[9px] hover:bg-[color-mix(in_oklch,#007BFE,black_12%)]"
      onClick={handleInstallReadyUpdate}
    >
      Update
    </Button>
  );
}
