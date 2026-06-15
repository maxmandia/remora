import type { VideoPreviewStack } from "../../lib/generation/index.ts";
import { DotFieldSkeleton } from "./dot-field-skeleton.tsx";
import {
  GenerationPreviewTile,
  type GenerationPreviewTileStackControl,
} from "./generation-preview-tile.tsx";

export function GenerationPreviewOutput({
  aspectRatio,
  previewStack,
  stackControl,
}: {
  aspectRatio: string;
  previewStack: VideoPreviewStack | null;
  stackControl?: GenerationPreviewTileStackControl;
}) {
  if (previewStack) {
    return (
      <GenerationPreviewTile
        aspectRatio={aspectRatio}
        previewStack={previewStack}
        {...(stackControl ? { stackControl } : {})}
      />
    );
  }

  // TODO: Render a dedicated error tile once generation jobs expose one.
  return (
    <DotFieldSkeleton
      className="size-40 shrink-0"
      data-testid="generation-thread-job"
    />
  );
}
