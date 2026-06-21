import { validateGenerationAttachmentMediaRules } from "@remora/domain/generation-attachment-media/validator";

import type { AttachmentMediaRole } from "./schema/table.ts";
import type { VideoFieldSpec, VideoModelSpec } from "../model/types.ts";
import {
  ObjectStorageService,
  type StoredObjectReference,
} from "../storage/object-storage.service.ts";
import type {
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaInput,
  GenerationAttachmentMediaInputItem,
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaMetadata,
  GenerationThreadAttachmentMedia,
  GenerationThreadAttachmentMediaValue,
  StoredGenerationAttachmentMedia,
} from "./generation-attachment-media.types.ts";
import {
  generationAttachmentMediaFieldIds,
  GenerationAttachmentMediaValidationError,
} from "./generation-attachment-media.types.ts";

const generationAttachmentMediaObjectPrefix = "generation-attachment-media";

export function createGenerationAttachmentMediaObjectKey({
  kind,
  mediaId,
  originalFileName,
  userId,
}: {
  userId: string;
  mediaId: string;
  kind: GenerationAttachmentMediaKind;
  originalFileName: string;
}) {
  return ObjectStorageService.joinObjectKey(
    generationAttachmentMediaObjectPrefix,
    "users",
    userId,
    kind,
    `${mediaId}${getSafeObjectExtension(originalFileName)}`,
  );
}

export function toStoredGenerationAttachmentMedia({
  kind,
  mediaId,
  metadata,
  originalFileName,
  storedObject,
  userId,
}: {
  mediaId: string;
  userId: string;
  kind: GenerationAttachmentMediaKind;
  originalFileName: string;
  metadata: StoredGenerationAttachmentMedia["metadata"];
  storedObject: StoredObjectReference;
}): Omit<StoredGenerationAttachmentMedia, "createdAt" | "updatedAt"> {
  return {
    id: mediaId,
    userId,
    kind,
    originalFileName,
    bucket: storedObject.bucket,
    objectKey: storedObject.objectKey,
    contentType: storedObject.contentType,
    contentLength: storedObject.contentLength,
    etag: storedObject.etag,
    checksumSha256: storedObject.checksumSha256,
    metadata,
  };
}

function getSafeObjectExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return "";
  }

  const extension = fileName.slice(dotIndex).toLowerCase();

  return /^[a-z0-9.]+$/.test(extension) ? extension : "";
}

export const emptyGenerationAttachmentMediaValue =
  generationAttachmentMediaFieldIds.reduce((value, fieldId) => {
    value[fieldId] = [];
    return value;
  }, {} as GenerationThreadAttachmentMediaValue);

export function createEmptyGenerationThreadAttachmentMediaValue(): GenerationThreadAttachmentMediaValue {
  return {
    images: [],
    videos: [],
    audios: [],
  };
}

export function isGenerationAttachmentMediaFieldId(
  fieldId: string,
): fieldId is GenerationAttachmentMediaFieldId {
  return (generationAttachmentMediaFieldIds as readonly string[]).includes(
    fieldId,
  );
}

export function normalizeGenerationAttachmentMediaInput(
  input: GenerationAttachmentMediaInput | undefined,
): Record<
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaInputItem[]
> {
  return {
    images: input?.images ?? [],
    videos: input?.videos ?? [],
    audios: input?.audios ?? [],
  };
}

export function getAttachmentMediaKindForFieldId(
  fieldId: GenerationAttachmentMediaFieldId,
): GenerationAttachmentMediaKind {
  switch (fieldId) {
    case "images":
      return "image";
    case "videos":
      return "video";
    case "audios":
      return "audio";
  }
}

export function hasAttachmentMedia(
  attachmentMedia: GenerationThreadAttachmentMediaValue | undefined,
) {
  if (!attachmentMedia) {
    return false;
  }

  return Object.values(attachmentMedia).some((items) => items.length > 0);
}

export function getAttachmentMediaFieldSpec({
  fieldId,
  spec,
}: {
  fieldId: GenerationAttachmentMediaFieldId;
  spec: VideoModelSpec;
}) {
  const field = spec.fields.find((candidate) => candidate.id === fieldId);

  if (
    !field ||
    field.componentKind !== "mediaList" ||
    field.valueKind !== "array"
  ) {
    throw new GenerationAttachmentMediaValidationError(
      fieldId,
      `${fieldId} is not supported by this model`,
    );
  }

  return field;
}

export function validateAttachmentMediaFileAgainstSpec({
  contentLength,
  contentType,
  field,
  metadata,
  originalFileName,
}: {
  contentLength: number | null;
  contentType: string | null;
  field: VideoFieldSpec;
  metadata: GenerationAttachmentMediaMetadata;
  originalFileName: string;
}) {
  const constraints = field.mediaConstraints;

  if (!constraints) {
    return;
  }

  const extension = getFileExtension(originalFileName);
  const matchesExtension =
    extension !== "" && constraints.extensions.includes(extension);
  const matchesMime =
    contentType !== null && constraints.mimeTypes.includes(contentType);

  if (!matchesExtension && !matchesMime) {
    throw invalid(field.id, "format is not supported");
  }

  if (
    constraints.maxFileSizeBytes !== undefined &&
    contentLength !== null &&
    contentLength > constraints.maxFileSizeBytes
  ) {
    throw invalid(
      field.id,
      `file must be at most ${constraints.maxFileSizeBytes} bytes`,
    );
  }

  validateDimensions({ field, metadata });
  validateDuration({ field, metadata });
  validateFps({ field, metadata });
}

export function validateAttachmentMediaUploadAgainstKind({
  contentType,
  kind,
  metadata,
  originalFileName,
}: {
  contentType: string | null;
  kind: GenerationAttachmentMediaKind;
  metadata: GenerationAttachmentMediaMetadata;
  originalFileName: string;
}) {
  if (!matchesAttachmentMediaKind({ contentType, kind, originalFileName })) {
    throw invalid("kind", `file does not match ${kind} attachment media`);
  }

  switch (kind) {
    case "image":
      if (metadata.widthPx === null || metadata.heightPx === null) {
        throw invalid("kind", "image dimensions could not be detected");
      }
      return;
    case "video":
      if (metadata.widthPx === null || metadata.heightPx === null) {
        throw invalid("kind", "video dimensions could not be detected");
      }

      if (metadata.durationSec === null) {
        throw invalid("kind", "video duration could not be detected");
      }
      return;
    case "audio":
      if (metadata.durationSec === null) {
        throw invalid("kind", "audio duration could not be detected");
      }
      return;
  }
}

export function validateAttachmentMediaSelectionAgainstSpec({
  input,
  resolvedMedia,
  spec,
}: {
  input: Record<
    GenerationAttachmentMediaFieldId,
    GenerationAttachmentMediaInputItem[]
  >;
  resolvedMedia: StoredGenerationAttachmentMedia[];
  spec: VideoModelSpec;
}) {
  const mediaById = new Map(resolvedMedia.map((media) => [media.id, media]));

  for (const fieldId of generationAttachmentMediaFieldIds) {
    const items = input[fieldId];
    const ids = items.map((item) => item.id);

    if (items.length === 0) {
      continue;
    }

    const field = getAttachmentMediaFieldSpec({ fieldId, spec });
    const uniqueIds = new Set(ids);

    if (uniqueIds.size !== ids.length) {
      throw invalid(fieldId, "attachment media cannot include duplicates");
    }

    if (field.arrayMax !== undefined && ids.length > field.arrayMax) {
      throw invalid(fieldId, `must include at most ${field.arrayMax} files`);
    }

    validateAttachmentMediaRoleCapabilities({
      field,
      fieldId,
      roles: items.map((item) => item.role),
    });

    validateTotalDuration({
      field,
      media: ids.map((id) => {
        const item = mediaById.get(id);

        if (!item) {
          throw invalid(fieldId, "includes unavailable media");
        }

        if (item.kind !== getAttachmentMediaKindForFieldId(fieldId)) {
          throw invalid(fieldId, `must include ${fieldId} attachment media`);
        }

        validateAttachmentMediaFileAgainstSpec({
          contentLength: item.contentLength,
          contentType: item.contentType,
          field,
          metadata: item.metadata,
          originalFileName: item.originalFileName,
        });

        return item;
      }),
    });
  }

  validateAttachmentMediaRoleRules(input);

  for (const issue of validateGenerationAttachmentMediaRules({
    attachmentMedia: input,
    validationRules: spec.validationRules,
  })) {
    switch (issue.kind) {
      case "audioRequiresVisualAttachment":
        throw invalid(
          issue.fieldId,
          "audio attachments require an image or video attachment",
        );
    }
  }
}

export function toThreadAttachmentMediaValue(
  media: Array<
    StoredGenerationAttachmentMedia & {
      fieldId: GenerationAttachmentMediaFieldId;
      role: AttachmentMediaRole;
      position?: number;
    }
  >,
): GenerationThreadAttachmentMediaValue {
  const value = createEmptyGenerationThreadAttachmentMediaValue();

  for (const item of [...media].sort(
    (left, right) => (left.position ?? 0) - (right.position ?? 0),
  )) {
    value[item.fieldId].push(toThreadAttachmentMedia(item));
  }

  return value;
}

export function toThreadAttachmentMedia(
  media: StoredGenerationAttachmentMedia & {
    fieldId: GenerationAttachmentMediaFieldId;
    role: AttachmentMediaRole;
  },
): GenerationThreadAttachmentMedia {
  return {
    id: media.id,
    kind: media.kind,
    fieldId: media.fieldId,
    role: media.role,
    originalFileName: media.originalFileName,
    contentType: media.contentType,
    contentLength: media.contentLength,
    metadata: media.metadata,
    createdAt: media.createdAt.toISOString(),
  };
}

function matchesAttachmentMediaKind({
  contentType,
  kind,
  originalFileName,
}: {
  contentType: string | null;
  kind: GenerationAttachmentMediaKind;
  originalFileName: string;
}) {
  const extension = getFileExtension(originalFileName);
  const extensions = attachmentMediaExtensionsByKind[kind];

  if (extension && (extensions as readonly string[]).includes(extension)) {
    return true;
  }

  return contentType !== null && contentType.startsWith(`${kind}/`);
}

const attachmentMediaExtensionsByKind = {
  image: [".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".webp"],
  video: [".avi", ".m4v", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg", ".webm"],
  audio: [".aac", ".aiff", ".flac", ".m4a", ".mp3", ".ogg", ".opus", ".wav"],
} as const satisfies Record<GenerationAttachmentMediaKind, readonly string[]>;

export function flattenAttachmentMediaInput(
  input: Record<
    GenerationAttachmentMediaFieldId,
    GenerationAttachmentMediaInputItem[]
  >,
) {
  return generationAttachmentMediaFieldIds.flatMap((fieldId) =>
    input[fieldId].map((item, position) => ({
      id: item.id,
      fieldId,
      role: item.role,
      position,
    })),
  );
}

function validateAttachmentMediaRoleCapabilities({
  field,
  fieldId,
  roles,
}: {
  field: VideoFieldSpec;
  fieldId: GenerationAttachmentMediaFieldId;
  roles: AttachmentMediaRole[];
}) {
  if (field.componentKind !== "mediaList") {
    throw invalid(fieldId, `${fieldId} is not supported by this model`);
  }

  for (const role of roles) {
    if (!field.mediaRoleCapabilities.includes(role)) {
      throw invalid(fieldId, `${role} attachment role is not supported`);
    }
  }
}

function validateAttachmentMediaRoleRules(
  input: Record<
    GenerationAttachmentMediaFieldId,
    GenerationAttachmentMediaInputItem[]
  >,
) {
  const roles = generationAttachmentMediaFieldIds.flatMap((fieldId) =>
    input[fieldId].map((item) => item.role),
  );
  const firstFrameCount = countAttachmentMediaRole(roles, "firstFrame");
  const lastFrameCount = countAttachmentMediaRole(roles, "lastFrame");
  const hasReference = roles.includes("reference");
  const hasFrame = firstFrameCount > 0 || lastFrameCount > 0;

  if (firstFrameCount > 1) {
    throw invalid(
      "images",
      "attachment media can include at most one first frame",
    );
  }

  if (lastFrameCount > 1) {
    throw invalid(
      "images",
      "attachment media can include at most one last frame",
    );
  }

  if (lastFrameCount > 0 && firstFrameCount === 0) {
    throw invalid("images", "last frame attachments require a first frame");
  }

  if (hasReference && hasFrame) {
    throw invalid(
      "images",
      "reference attachments cannot be combined with first or last frame attachments",
    );
  }
}

function countAttachmentMediaRole(
  roles: AttachmentMediaRole[],
  role: AttachmentMediaRole,
) {
  return roles.filter((candidate) => candidate === role).length;
}

export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return "";
  }

  return fileName.slice(dotIndex).toLowerCase();
}

function validateDimensions({
  field,
  metadata,
}: {
  field: VideoFieldSpec;
  metadata: GenerationAttachmentMediaMetadata;
}) {
  const constraints = field.mediaConstraints;
  const requiresDimensions =
    constraints?.minDimensionPx !== undefined ||
    constraints?.maxDimensionPx !== undefined ||
    constraints?.minAspectRatio !== undefined ||
    constraints?.maxAspectRatio !== undefined ||
    constraints?.minTotalPixels !== undefined ||
    constraints?.maxTotalPixels !== undefined;

  if (!constraints || !requiresDimensions) {
    return;
  }

  if (metadata.widthPx === null || metadata.heightPx === null) {
    throw invalid(field.id, "dimensions could not be detected");
  }

  if (
    constraints.minDimensionPx !== undefined &&
    (metadata.widthPx < constraints.minDimensionPx ||
      metadata.heightPx < constraints.minDimensionPx)
  ) {
    throw invalid(
      field.id,
      `dimensions must be at least ${constraints.minDimensionPx}px`,
    );
  }

  if (
    constraints.maxDimensionPx !== undefined &&
    (metadata.widthPx > constraints.maxDimensionPx ||
      metadata.heightPx > constraints.maxDimensionPx)
  ) {
    throw invalid(
      field.id,
      `dimensions must be at most ${constraints.maxDimensionPx}px`,
    );
  }

  const aspectRatio = metadata.widthPx / metadata.heightPx;

  if (
    constraints.minAspectRatio !== undefined &&
    aspectRatio < constraints.minAspectRatio
  ) {
    throw invalid(
      field.id,
      `aspect ratio must be at least ${constraints.minAspectRatio}`,
    );
  }

  if (
    constraints.maxAspectRatio !== undefined &&
    aspectRatio > constraints.maxAspectRatio
  ) {
    throw invalid(
      field.id,
      `aspect ratio must be at most ${constraints.maxAspectRatio}`,
    );
  }

  const totalPixels = metadata.widthPx * metadata.heightPx;

  if (
    constraints.minTotalPixels !== undefined &&
    totalPixels < constraints.minTotalPixels
  ) {
    throw invalid(
      field.id,
      `total pixels must be at least ${constraints.minTotalPixels}`,
    );
  }

  if (
    constraints.maxTotalPixels !== undefined &&
    totalPixels > constraints.maxTotalPixels
  ) {
    throw invalid(
      field.id,
      `total pixels must be at most ${constraints.maxTotalPixels}`,
    );
  }
}

function validateDuration({
  field,
  metadata,
}: {
  field: VideoFieldSpec;
  metadata: GenerationAttachmentMediaMetadata;
}) {
  const constraints = field.mediaConstraints;
  const requiresDuration =
    constraints?.minDurationSec !== undefined ||
    constraints?.maxDurationSec !== undefined;

  if (!constraints || !requiresDuration) {
    return;
  }

  if (metadata.durationSec === null) {
    throw invalid(field.id, "duration could not be detected");
  }

  if (
    constraints.minDurationSec !== undefined &&
    metadata.durationSec < constraints.minDurationSec
  ) {
    throw invalid(
      field.id,
      `duration must be at least ${constraints.minDurationSec} seconds`,
    );
  }

  if (
    constraints.maxDurationSec !== undefined &&
    metadata.durationSec > constraints.maxDurationSec
  ) {
    throw invalid(
      field.id,
      `duration must be at most ${constraints.maxDurationSec} seconds`,
    );
  }
}

function validateFps({
  field,
  metadata,
}: {
  field: VideoFieldSpec;
  metadata: GenerationAttachmentMediaMetadata;
}) {
  const constraints = field.mediaConstraints;
  const requiresFps =
    constraints?.minFps !== undefined || constraints?.maxFps !== undefined;

  if (!constraints || !requiresFps) {
    return;
  }

  if (metadata.fps === null) {
    throw invalid(field.id, "frame rate could not be detected");
  }

  if (constraints.minFps !== undefined && metadata.fps < constraints.minFps) {
    throw invalid(
      field.id,
      `frame rate must be at least ${constraints.minFps}`,
    );
  }

  if (constraints.maxFps !== undefined && metadata.fps > constraints.maxFps) {
    throw invalid(field.id, `frame rate must be at most ${constraints.maxFps}`);
  }
}

function validateTotalDuration({
  field,
  media,
}: {
  field: VideoFieldSpec;
  media: StoredGenerationAttachmentMedia[];
}) {
  const maxTotalDurationSec = field.mediaConstraints?.maxTotalDurationSec;

  if (maxTotalDurationSec === undefined || media.length === 0) {
    return;
  }

  const totalDurationSec = media.reduce((total, item) => {
    if (item.metadata.durationSec === null) {
      throw invalid(field.id, "duration could not be detected");
    }

    return total + item.metadata.durationSec;
  }, 0);

  if (totalDurationSec > maxTotalDurationSec) {
    throw invalid(
      field.id,
      `total duration must be at most ${maxTotalDurationSec} seconds`,
    );
  }
}

function invalid(
  field: string,
  message: string,
): GenerationAttachmentMediaValidationError {
  return new GenerationAttachmentMediaValidationError(field, message);
}
