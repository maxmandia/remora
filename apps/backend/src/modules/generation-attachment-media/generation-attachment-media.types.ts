import type { MediaConstraints } from "../model/model.types.ts";
import type { AttachmentMediaRole } from "./schema/table.ts";

export const generationAttachmentMediaFieldIds = [
  "images",
  "videos",
  "audios",
] as const;

export type GenerationAttachmentMediaFieldId =
  (typeof generationAttachmentMediaFieldIds)[number];

export const generationAttachmentMediaKinds = [
  "image",
  "video",
  "audio",
] as const;

export type GenerationAttachmentMediaKind =
  (typeof generationAttachmentMediaKinds)[number];

export type GenerationAttachmentMediaInputItem<
  Role extends AttachmentMediaRole = AttachmentMediaRole,
> = {
  id: string;
  role: Role;
};

export type GenerationAttachmentMediaInput = {
  images?: GenerationAttachmentMediaInputItem<
    "firstFrame" | "lastFrame" | "reference"
  >[];
  videos?: GenerationAttachmentMediaInputItem<"reference">[];
  audios?: GenerationAttachmentMediaInputItem<"reference">[];
};

export type GenerationAttachmentMediaMetadata = {
  widthPx: number | null;
  heightPx: number | null;
  durationSec: number | null;
  fps: number | null;
};

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

export type GenerationAttachmentMediaUploadResult = {
  id: string;
  kind: GenerationAttachmentMediaKind;
  originalFileName: string;
  contentType: string | null;
  contentLength: number | null;
  metadata: GenerationAttachmentMediaMetadata;
};

export type GenerationThreadAttachmentMedia = {
  id: string;
  kind: GenerationAttachmentMediaKind;
  fieldId: GenerationAttachmentMediaFieldId;
  role: AttachmentMediaRole;
  originalFileName: string;
  contentType: string | null;
  contentLength: number | null;
  metadata: GenerationAttachmentMediaMetadata;
  createdAt: string;
};

export type GenerationThreadAttachmentMediaValue = Record<
  GenerationAttachmentMediaFieldId,
  GenerationThreadAttachmentMedia[]
>;

export type SignedGenerationAttachmentMedia = {
  fieldId: GenerationAttachmentMediaFieldId;
  role: AttachmentMediaRole;
  url: string;
};

export type SignedGenerationThreadAttachmentMedia =
  GenerationThreadAttachmentMedia & {
    url: string;
    urlExpiresAt: string;
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
