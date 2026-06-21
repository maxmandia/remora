export type { AuthUser } from "./modules/auth/types.ts";
export type { AppRouter } from "./trpc/router.ts";
// TODO: Instead of exporting these from the backend it might make more sense to export these from a package
export {
  createVideoGenerationFieldIds,
  defaultRequestedGenerations,
  maxRequestedGenerations,
  minRequestedGenerations,
} from "./modules/generation/generation.types.ts";
export { attachmentMediaRoles } from "./modules/generation-attachment-media/schema/table.ts";
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
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaInput,
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaMetadata,
  GenerationAttachmentMediaUploadResult,
  GenerationThreadAttachmentMedia,
  GenerationThreadAttachmentMediaValue,
  SignedGenerationThreadAttachmentMedia,
} from "./modules/generation-attachment-media/generation-attachment-media.types.ts";
export type { AttachmentMediaRole } from "./modules/generation-attachment-media/schema/table.ts";
export type {
  CanonicalVideoFieldId,
  MediaConstraints,
  PublishedGenerationModelSummary,
  VideoFieldSpec,
  VideoAttachmentMediaFieldSpec,
} from "./modules/model/types.ts";
