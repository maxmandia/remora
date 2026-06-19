export type { AuthUser } from "./modules/auth/types.ts";
export type { AppRouter } from "./trpc/router.ts";
// TODO: Instead of exporting these from the backend it might make more sense to export these from a package
export {
  createVideoGenerationFieldIds,
  defaultRequestedGenerations,
  maxRequestedGenerations,
  minRequestedGenerations,
} from "./modules/generation/generation.types.ts";
export type {
  CreateVideoGenerationFieldId,
  CreateVideoGenerationInput,
  GenerationJobTerminalError,
  GenerationJobStatus,
  GenerationThreadJobResult,
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  GenerationThreadSummary,
} from "./modules/generation/generation.types.ts";
export type {
  GenerationReferenceMediaFieldId,
  GenerationReferenceMediaInput,
  GenerationReferenceMediaKind,
  GenerationReferenceMediaMetadata,
  GenerationReferenceMediaUploadResult,
  GenerationThreadReferenceMedia,
  GenerationThreadReferenceMediaValue,
  SignedGenerationThreadReferenceMedia,
} from "./modules/generation-reference-media/generation-reference-media.types.ts";
export type {
  CanonicalVideoFieldId,
  MediaConstraints,
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "./modules/model/types.ts";
