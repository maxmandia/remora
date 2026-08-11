import {
  GenerationResultsSurface as SharedGenerationResultsSurface,
  type GenerationResultsActivePanel,
  type GeneratedImageContextMenuHandler,
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
  onGeneratedImageContextMenu: GeneratedImageContextMenuHandler;
  onActivePanelToggle: (panel: GenerationResultsActivePanel | null) => void;
  onEditSubmission: (submission: GenerationThreadSubmission) => Promise<void>;
};

type GenerationResultsSurfaceProps = {
  activePanel: GenerationResultsActivePanel | null;
  pendingFreshThreadSubmission: GenerationThreadSubmission | null;
  attachmentMediaPanelId: string;
  stackPanelId: string;
  threadId: string | null;
  onGeneratedImageContextMenu: GeneratedImageContextMenuHandler;
  onActivePanelToggle: (panel: GenerationResultsActivePanel | null) => void;
  onEditSubmission: (submission: GenerationThreadSubmission) => Promise<void>;
};

export function GenerationResultsSurface({
  activePanel,
  pendingFreshThreadSubmission,
  attachmentMediaPanelId,
  stackPanelId,
  threadId,
  onGeneratedImageContextMenu,
  onActivePanelToggle,
  onEditSubmission,
}: GenerationResultsSurfaceProps) {
  return (
    <SharedGenerationResultsSurface
      activePanel={activePanel}
      attachmentMediaPanelId={attachmentMediaPanelId}
      onGeneratedImageContextMenu={onGeneratedImageContextMenu}
      pendingFreshThreadSubmission={pendingFreshThreadSubmission}
      renderImageViewer={(props) => (
        <GenerationImageViewerModal
          {...props}
          onGeneratedImageContextMenu={onGeneratedImageContextMenu}
        />
      )}
      renderVideoViewer={(props) => <GenerationVideoPlaybackModal {...props} />}
      stackPanelId={stackPanelId}
      threadId={threadId}
      variant="overlay"
      onActivePanelToggle={onActivePanelToggle}
      onEditSubmission={onEditSubmission}
    />
  );
}

export function GenerationResults({
  activePanel,
  attachmentMediaPanelId,
  stackPanelId,
  threadId,
  onGeneratedImageContextMenu,
  onActivePanelToggle,
  onEditSubmission,
}: GenerationResultsProps) {
  return (
    <GenerationResultsSurface
      activePanel={activePanel}
      attachmentMediaPanelId={attachmentMediaPanelId}
      pendingFreshThreadSubmission={null}
      stackPanelId={stackPanelId}
      threadId={threadId}
      onGeneratedImageContextMenu={onGeneratedImageContextMenu}
      onActivePanelToggle={onActivePanelToggle}
      onEditSubmission={onEditSubmission}
    />
  );
}
