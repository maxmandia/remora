import type {
  GenerationThreadSubmission,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";

export function isFluxGenerationDraftSubmission(
  submission: GenerationThreadSubmission,
): submission is VideoGenerationThreadSubmission {
  return (
    submission.modelType === "video" &&
    submission.modelId === "flux-3-video" &&
    submission.submittedInput.draft
  );
}
