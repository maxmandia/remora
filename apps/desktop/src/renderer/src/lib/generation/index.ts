import type {
  CreateVideoGenerationFieldId,
  CreateVideoGenerationInput,
  GenerationJobStatus,
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";
import { defaultRequestedGenerations } from "@remora/backend/types";
import { isPrimitiveSelectValue } from "@remora/utils";

export type GenerationModelSettingsFieldId = Exclude<
  CreateVideoGenerationFieldId,
  "prompt"
>;

export type GenerationSettingsFieldId =
  | GenerationModelSettingsFieldId
  | "requestedGenerations";

export const orderedGenerationSettingIds = [
  "requestedGenerations",
  "aspectRatio",
  "duration",
  "generateAudio",
] as const satisfies readonly GenerationSettingsFieldId[];

type AssertNever<T extends never> = T;

export type AssertGenerationSettingsFieldCoverage = AssertNever<
  Exclude<
    GenerationSettingsFieldId,
    (typeof orderedGenerationSettingIds)[number]
  >
>;

export type GenerationSettingsValue = Pick<
  CreateVideoGenerationInput,
  GenerationSettingsFieldId
>;

export const generationVideoPreviewFallbackImageUrl =
  "/generation-video-preview-fallback.png" as const;

export type VideoPreviewOrFallback =
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
    }
  | null;

// TODO: Once we add image models we'll either need to make a new helper or modify this one.
export function findVideoPreviewOrFallback(
  submission: GenerationThreadSubmission,
): VideoPreviewOrFallback {
  const succeededGenerationJobStatus =
    "succeeded" satisfies GenerationJobStatus;
  let fallbackJob: GenerationThreadSubmissionJob | null = null;

  const displayableJobs = [...submission.jobs].sort(
    (leftJob, rightJob) => leftJob.submissionIndex - rightJob.submissionIndex,
  );

  for (const job of displayableJobs) {
    if (job.status !== succeededGenerationJobStatus || !job.result) {
      continue;
    }

    if (job.result.previewImageUrl) {
      return {
        kind: "preview",
        previewImageUrl: job.result.previewImageUrl,
        videoUrl: job.result.videoUrl,
        job,
      };
    }

    if (job.result.videoUrl && !fallbackJob) {
      fallbackJob = job;
    }
  }

  const fallbackVideoUrl = fallbackJob?.result?.videoUrl;

  if (fallbackJob && fallbackVideoUrl) {
    return {
      kind: "fallback",
      previewImageUrl: generationVideoPreviewFallbackImageUrl,
      videoUrl: fallbackVideoUrl,
      reason: "missingVideoPreview",
      job: fallbackJob,
    };
  }

  // If we're returning null we haven't found any jobs with the succeeded status
  return null;
}

export function getDefaultGenerationSettings(
  selectedModel: PublishedGenerationModelSummary | null,
): GenerationSettingsValue | null {
  if (!selectedModel) {
    return null;
  }

  const aspectRatio = getDefaultFieldValue(
    selectedModel,
    "aspectRatio",
    "string",
  );
  const duration = getDefaultFieldValue(selectedModel, "duration", "number");
  const generateAudio = getDefaultFieldValue(
    selectedModel,
    "generateAudio",
    "boolean",
  );

  if (
    typeof aspectRatio !== "string" ||
    typeof duration !== "number" ||
    typeof generateAudio !== "boolean"
  ) {
    return null;
  }

  return {
    aspectRatio,
    duration,
    generateAudio,
    requestedGenerations: defaultRequestedGenerations,
  };
}

function getDefaultFieldValue(
  model: PublishedGenerationModelSummary,
  fieldId: GenerationModelSettingsFieldId,
  valueType: "string" | "number" | "boolean",
) {
  const field = model.spec.fields.find((candidate) => candidate.id === fieldId);

  if (!field) {
    return null;
  }

  if (
    isPrimitiveSelectValue(field.defaultValue) &&
    typeof field.defaultValue === valueType
  ) {
    return field.defaultValue;
  }

  return field.options?.find((option) => typeof option.value === valueType)
    ?.value;
}
