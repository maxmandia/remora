import { useCallback, useEffect, useId, useState } from "react";

import { useHotkey } from "../providers/hotkeys-provider.tsx";

export type GenerationResultsActivePanel =
  | {
      kind: "generationOutput";
      submissionId: string;
    }
  | {
      kind: "attachmentMedia";
      submissionId: string;
    };

export function useGenerationResultsPanelController({
  scopeKey,
}: {
  scopeKey: string | null;
}) {
  const attachmentMediaPanelId = useId();
  const stackPanelId = useId();
  const [activePanel, setActivePanel] =
    useState<GenerationResultsActivePanel | null>(null);
  const closePanel = useCallback(() => setActivePanel(null), []);
  const togglePanel = useCallback(
    (panel: GenerationResultsActivePanel | null) => {
      setActivePanel((currentPanel) =>
        currentPanel &&
        panel &&
        currentPanel.kind === panel.kind &&
        currentPanel.submissionId === panel.submissionId
          ? null
          : panel,
      );
    },
    [],
  );

  useHotkey("generation.closeStackPanel", {
    allowInEditable: true,
    enabled: Boolean(activePanel),
    onKeyDown: closePanel,
  });

  useEffect(() => {
    setActivePanel(null);
  }, [scopeKey]);

  return {
    activePanel,
    attachmentMediaPanelId,
    closePanel,
    isPanelOpen: Boolean(activePanel),
    stackPanelId,
    togglePanel,
  };
}
