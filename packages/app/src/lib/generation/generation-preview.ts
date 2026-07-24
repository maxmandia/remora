import type {
  GenerationJobStatus,
  ImageGenerationThreadSubmission,
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";

export const generationVideoPreviewFallbackImageUrl = new URL(
  "../../assets/generation-video-preview-fallback.png",
  import.meta.url,
).href;

export const multiGenerationPanelClosedTransform = "translate3d(0, 0, 0)";

export const multiGenerationPanelOpenTransform =
  "translate3d(calc((var(--remora-generation-stack-panel-shift-width) + var(--remora-generation-stack-panel-gap)) / -2), 0, 0)";

export const multiGenerationPanelShiftClassName =
  "transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none";

export function getMultiGenerationPanelShiftTransform(isOpen: boolean) {
  return isOpen
    ? multiGenerationPanelOpenTransform
    : multiGenerationPanelClosedTransform;
}

export type VideoPreviewStackLayer =
  | {
      kind: "preview";
      previewImageUrl: string;
      videoUrl: string | null;
      job: GenerationThreadSubmissionJob;
    }
  | {
      kind: "fallback";
      previewImageUrl: typeof generationVideoPreviewFallbackImageUrl;
      videoUrl: string;
      reason: "missingVideoPreview";
      job: GenerationThreadSubmissionJob;
    };

export type VideoPreviewStack = {
  layers: [VideoPreviewStackLayer, ...VideoPreviewStackLayer[]];
};

export type ImagePreviewStackLayer = {
  kind: "image";
  previewImageUrl: string;
  imageUrl: string;
  job: GenerationThreadSubmissionJob;
};

export type ImagePreviewStack = {
  layers: [ImagePreviewStackLayer, ...ImagePreviewStackLayer[]];
};

export type GenerationPreviewStack = VideoPreviewStack | ImagePreviewStack;

const maxVisiblePreviewStackLayers = 3;

export function buildVideoPreviewStackForJob(
  job: GenerationThreadSubmissionJob,
): VideoPreviewStack | null {
  const layer = buildVideoPreviewLayerForJob(job);

  if (!layer) {
    return null;
  }

  return {
    layers: [layer],
  };
}

// TODO: Once we add image models we'll either need to make a new helper or modify this one.
export function buildVideoPreviewStack(
  submission: VideoGenerationThreadSubmission,
): VideoPreviewStack | null {
  const displayableLayers = listDisplayableVideoPreviewLayers(submission);
  const frontLayer =
    displayableLayers.find((layer) => layer.kind === "preview") ??
    displayableLayers[0];

  if (!frontLayer) {
    return null;
  }

  const visibleLayerCount =
    submission.requestedGenerations > 1
      ? Math.min(submission.requestedGenerations, maxVisiblePreviewStackLayers)
      : 1;
  const layers: [VideoPreviewStackLayer, ...VideoPreviewStackLayer[]] = [
    frontLayer,
  ];

  for (const layer of displayableLayers) {
    if (
      layers.length >= visibleLayerCount ||
      layer.job.id === frontLayer.job.id
    ) {
      continue;
    }

    layers.push(layer);
  }

  while (layers.length < visibleLayerCount) {
    layers.push(frontLayer);
  }

  return {
    layers,
  };
}

export function buildImagePreviewStackForJob(
  job: GenerationThreadSubmissionJob,
): ImagePreviewStack | null {
  const layer = buildImagePreviewLayerForJob(job);

  if (!layer) {
    return null;
  }

  return {
    layers: [layer],
  };
}

export function buildImagePreviewStack(
  submission: ImageGenerationThreadSubmission,
): ImagePreviewStack | null {
  const displayableLayers = listDisplayableImagePreviewLayers(submission);
  const frontLayer = displayableLayers[0];

  if (!frontLayer) {
    return null;
  }

  const visibleLayerCount =
    submission.requestedGenerations > 1
      ? Math.min(submission.requestedGenerations, maxVisiblePreviewStackLayers)
      : 1;
  const layers: [ImagePreviewStackLayer, ...ImagePreviewStackLayer[]] = [
    frontLayer,
  ];

  for (const layer of displayableLayers.slice(1)) {
    if (layers.length >= visibleLayerCount) {
      break;
    }

    layers.push(layer);
  }

  while (layers.length < visibleLayerCount) {
    layers.push(frontLayer);
  }

  return {
    layers,
  };
}

function listDisplayableVideoPreviewLayers(
  submission: GenerationThreadSubmission,
) {
  return [...submission.jobs]
    .sort(
      (leftJob, rightJob) => leftJob.submissionIndex - rightJob.submissionIndex,
    )
    .flatMap((job): VideoPreviewStackLayer[] => {
      const layer = buildVideoPreviewLayerForJob(job);

      return layer ? [layer] : [];
    });
}

function buildVideoPreviewLayerForJob(
  job: GenerationThreadSubmissionJob,
): VideoPreviewStackLayer | null {
  const succeededGenerationJobStatus =
    "succeeded" satisfies GenerationJobStatus;

  if (job.status !== succeededGenerationJobStatus || !job.result) {
    return null;
  }

  if (job.result.previewImageUrl) {
    return {
      kind: "preview",
      previewImageUrl: job.result.previewImageUrl,
      videoUrl: job.result.videoUrl,
      job,
    };
  }

  if (job.result.videoUrl) {
    return {
      kind: "fallback",
      previewImageUrl: generationVideoPreviewFallbackImageUrl,
      videoUrl: job.result.videoUrl,
      reason: "missingVideoPreview",
      job,
    };
  }

  return null;
}

function listDisplayableImagePreviewLayers(
  submission: GenerationThreadSubmission,
) {
  return [...submission.jobs]
    .sort(
      (leftJob, rightJob) => leftJob.submissionIndex - rightJob.submissionIndex,
    )
    .flatMap((job): ImagePreviewStackLayer[] => {
      const layer = buildImagePreviewLayerForJob(job);

      return layer ? [layer] : [];
    });
}

function buildImagePreviewLayerForJob(
  job: GenerationThreadSubmissionJob,
): ImagePreviewStackLayer | null {
  const succeededGenerationJobStatus =
    "succeeded" satisfies GenerationJobStatus;

  if (job.status !== succeededGenerationJobStatus || !job.result) {
    return null;
  }

  const imageUrl = job.result.assets?.find(
    (asset) => asset.kind === "image",
  )?.url;

  if (!imageUrl) {
    return null;
  }

  return {
    kind: "image",
    previewImageUrl: imageUrl,
    imageUrl,
    job,
  };
}
