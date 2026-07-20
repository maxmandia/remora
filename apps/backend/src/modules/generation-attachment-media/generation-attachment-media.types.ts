import type {
  AttachmentMediaRole,
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaMetadata,
} from "@remora/domain/generation-attachment-media/dto";
import type { MediaConstraints } from "@remora/domain/generation-model/dto";
export {
  generationAttachmentMediaFieldIds,
  generationAttachmentMediaKinds,
} from "@remora/domain/generation-attachment-media/dto";
export type {
  AttachmentMediaRole,
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaInput,
  GenerationAttachmentMediaInputItem,
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaMetadata,
  GenerationAttachmentMediaUploadResult,
  GenerationThreadAttachmentMedia,
  GenerationThreadAttachmentMediaValue,
  SignedGenerationThreadAttachmentMedia,
} from "@remora/domain/generation-attachment-media/dto";

export type StoredGenerationAttachmentMedia = {
  id: string;
  userId: string;
  kind: GenerationAttachmentMediaKind;
  originalFileName: string;
  bucket: string;
  objectKey: string;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  checksumSha256: string | null;
  metadata: GenerationAttachmentMediaMetadata;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredGenerationAttachmentMediaWithPosition =
  StoredGenerationAttachmentMedia & {
    fieldId: GenerationAttachmentMediaFieldId;
    role: AttachmentMediaRole;
    position: number;
  };

export type GenerationAttachmentMediaUploadInput = {
  userId: string;
  kind: GenerationAttachmentMediaKind;
  originalFileName: string;
  contentType: string | null;
  contentLength: number | null;
  body: NodeJS.ReadableStream;
};

export type SignedGenerationAttachmentMedia = {
  fieldId: GenerationAttachmentMediaFieldId;
  role: AttachmentMediaRole;
  url: string;
};

export type GenerationAttachmentMediaConstraints = MediaConstraints;

// Mirrors the field+message shape of the generation module's
// GenerationInputValidationError so this module owns its own validation error
// without depending on the generation module. The code is kept identical so the
// upload route and createVideo flow continue to surface the same value to
// clients.
export class GenerationAttachmentMediaValidationError extends Error {
  readonly code = "INVALID_GENERATION_INPUT";
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "GenerationAttachmentMediaValidationError";
    this.field = field;
  }
}
