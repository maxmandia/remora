import { toast } from "@remora/ui";
import { useCallback, type MouseEvent } from "react";

import { generatedImageBridge } from "../lib/generated-image-bridge.ts";

export function useGeneratedImageContextMenuHandler() {
  return useCallback((jobId: string, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void generatedImageBridge
      .showContextMenu({ jobId })
      .catch(() => toast.error("Unable to open image menu."));
  }, []);
}

export function useGeneratedImageContextMenu(jobId: string | null) {
  const openContextMenuForJob = useGeneratedImageContextMenuHandler();
  const openContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!jobId) {
        return;
      }

      openContextMenuForJob(jobId, event);
    },
    [jobId, openContextMenuForJob],
  );

  return jobId ? openContextMenu : undefined;
}
