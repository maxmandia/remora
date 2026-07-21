import type { GenerationPreviewStack } from "../../lib/generation/index.ts";
import { DotFieldSkeleton } from "./dot-field-skeleton.tsx";
import {
  GenerationPreviewTile,
  type GenerationPreviewTileStackControl,
} from "./generation-preview-tile.tsx";

export function GenerationPreviewOutput({
  aspectRatio,
  previewStack,
  responsive = false,
  stackControl,
}: {
  aspectRatio: string;
  previewStack: GenerationPreviewStack | null;
  responsive?: boolean;
  stackControl?: GenerationPreviewTileStackControl;
}) {
  if (previewStack) {
    return (
      <GenerationPreviewTile
        aspectRatio={aspectRatio}
        previewStack={previewStack}
        responsive={responsive}
        {...(stackControl ? { stackControl } : {})}
      />
    );
  }

  // TODO: Render a dedicated error tile once generation jobs expose one.
  return (
    <DotFieldSkeleton
      className={
        responsive
          ? "aspect-square w-full max-w-40 shrink-0"
          : "size-40 shrink-0"
      }
      data-testid="generation-thread-job"
    />
  );
}
