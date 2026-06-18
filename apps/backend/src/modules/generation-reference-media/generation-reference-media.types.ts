import type { MediaConstraints } from "../model/types.ts";

export const generationReferenceMediaFieldIds = [
  "images",
  "videos",
  "audios",
] as const;

export type GenerationReferenceMediaFieldId =
  (typeof generationReferenceMediaFieldIds)[number];

export const generationReferenceMediaKinds = [
  "image",
  "video",
  "audio",
] as const;

export type GenerationReferenceMediaKind =
  (typeof generationReferenceMediaKinds)[number];

export type GenerationReferenceMediaInput = Partial<
  Record<GenerationReferenceMediaFieldId, string[]>
>;

export type GenerationReferenceMediaMetadata = {
  widthPx: number | null;
  heightPx: number | null;
  durationSec: number | null;
  fps: number | null;
};

export type StoredGenerationReferenceMedia = {
  id: string;
  userId: string;
  kind: GenerationReferenceMediaKind;
  originalFileName: string;
  bucket: string;
  objectKey: string;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  checksumSha256: string | null;
  metadata: GenerationReferenceMediaMetadata;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredGenerationReferenceMediaWithPosition =
  StoredGenerationReferenceMedia & {
    fieldId: GenerationReferenceMediaFieldId;
    position: number;
  };

export type GenerationReferenceMediaUploadInput = {
  userId: string;
  kind: GenerationReferenceMediaKind;
  originalFileName: string;
  contentType: string | null;
  contentLength: number | null;
  body: NodeJS.ReadableStream;
};

export type GenerationReferenceMediaUploadResult = {
  id: string;
  kind: GenerationReferenceMediaKind;
  originalFileName: string;
  contentType: string | null;
  contentLength: number | null;
  metadata: GenerationReferenceMediaMetadata;
};

export type GenerationThreadReferenceMedia = {
  id: string;
  kind: GenerationReferenceMediaKind;
  fieldId: GenerationReferenceMediaFieldId;
  originalFileName: string;
  contentType: string | null;
  contentLength: number | null;
  metadata: GenerationReferenceMediaMetadata;
  createdAt: string;
};

export type GenerationThreadReferenceMediaValue = Record<
  GenerationReferenceMediaFieldId,
  GenerationThreadReferenceMedia[]
>;

export type SignedGenerationReferenceMedia = {
  fieldId: GenerationReferenceMediaFieldId;
  url: string;
};

export type GenerationReferenceMediaConstraints = MediaConstraints;

// Mirrors the field+message shape of the generation module's
// GenerationInputValidationError so this module owns its own validation error
// without depending on the generation module. The code is kept identical so the
// upload route and createVideo flow continue to surface the same value to
// clients.
export class GenerationReferenceMediaValidationError extends Error {
  readonly code = "INVALID_GENERATION_INPUT";
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "GenerationReferenceMediaValidationError";
    this.field = field;
  }
}
