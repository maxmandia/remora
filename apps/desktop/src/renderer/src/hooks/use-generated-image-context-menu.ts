import { toast } from "@remora/ui";
import { useCallback, type MouseEvent } from "react";

import { generatedImageBridge } from "../lib/generated-image-bridge.ts";

export function useGeneratedImageContextMenu(jobId: string | null) {
  const openContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!jobId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void generatedImageBridge
        .showContextMenu({ jobId })
        .catch(() => toast.error("Unable to open image menu."));
    },
    [jobId],
  );

  return jobId ? openContextMenu : undefined;
}
