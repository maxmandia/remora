import type { GenerationThreadSubmissionJob } from "@remora/domain/generation-submission/dto";

import type { GenerationPreviewStack } from "../../lib/generation/index.ts";
import { DotFieldSkeleton } from "./dot-field-skeleton.tsx";
import { GenerationFailedOutput } from "./generation-failed-output.tsx";
import {
  GenerationPreviewTile,
  type GenerationPreviewTileStackControl,
} from "./generation-preview-tile.tsx";

export function GenerationPreviewOutput({
  aspectRatio,
  job,
  previewStack,
  responsive = false,
  stackControl,
}: {
  aspectRatio: string;
  job?: GenerationThreadSubmissionJob | null;
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

  if (job?.status === "failed") {
    return <GenerationFailedOutput job={job} responsive={responsive} />;
  }

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
