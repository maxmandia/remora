export const attachmentMediaRoles = [
  "reference",
  "firstFrame",
  "lastFrame",
] as const;

export type AttachmentMediaRole = (typeof attachmentMediaRoles)[number];

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

export type SignedGenerationThreadAttachmentMedia =
  GenerationThreadAttachmentMedia & {
    url: string;
    urlExpiresAt: string;
  };
