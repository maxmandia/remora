import {
  GenerationResultsSurface as SharedGenerationResultsSurface,
  type GenerationResultsActivePanel,
} from "@remora/app/generation";
import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";

import { GenerationImageViewerModal } from "./generation-image-viewer-modal.tsx";
import { GenerationVideoPlaybackModal } from "./generation-video-playback-modal.tsx";

export type { GenerationResultsActivePanel } from "@remora/app/generation";

type GenerationResultsProps = {
  activePanel: GenerationResultsActivePanel | null;
  attachmentMediaPanelId: string;
  stackPanelId: string;
  threadId: string;
  onActivePanelToggle: (panel: GenerationResultsActivePanel | null) => void;
};

type GenerationResultsSurfaceProps = {
  activePanel: GenerationResultsActivePanel | null;
  pendingFreshThreadSubmission: GenerationThreadSubmission | null;
  attachmentMediaPanelId: string;
  stackPanelId: string;
  threadId: string | null;
  onActivePanelToggle: (panel: GenerationResultsActivePanel | null) => void;
};

export function GenerationResultsSurface({
  activePanel,
  pendingFreshThreadSubmission,
  attachmentMediaPanelId,
  stackPanelId,
  threadId,
  onActivePanelToggle,
}: GenerationResultsSurfaceProps) {
  return (
    <SharedGenerationResultsSurface
      activePanel={activePanel}
      attachmentMediaPanelId={attachmentMediaPanelId}
      pendingFreshThreadSubmission={pendingFreshThreadSubmission}
      renderImageViewer={(props) => <GenerationImageViewerModal {...props} />}
      renderVideoViewer={(props) => <GenerationVideoPlaybackModal {...props} />}
      stackPanelId={stackPanelId}
      threadId={threadId}
      variant="overlay"
      onActivePanelToggle={onActivePanelToggle}
    />
  );
}

export function GenerationResults({
  activePanel,
  attachmentMediaPanelId,
  stackPanelId,
  threadId,
  onActivePanelToggle,
}: GenerationResultsProps) {
  return (
    <GenerationResultsSurface
      activePanel={activePanel}
      attachmentMediaPanelId={attachmentMediaPanelId}
      pendingFreshThreadSubmission={null}
      stackPanelId={stackPanelId}
      threadId={threadId}
      onActivePanelToggle={onActivePanelToggle}
    />
  );
}
