import type { VideoFieldSpec, VideoModelSpec } from "../model/types.ts";
import {
  ObjectStorageService,
  type StoredObjectReference,
} from "../storage/object-storage.service.ts";
import type {
  GenerationReferenceMediaFieldId,
  GenerationReferenceMediaInput,
  GenerationReferenceMediaKind,
  GenerationReferenceMediaMetadata,
  GenerationThreadReferenceMedia,
  GenerationThreadReferenceMediaValue,
  StoredGenerationReferenceMedia,
} from "./generation-reference-media.types.ts";
import {
  generationReferenceMediaFieldIds,
  GenerationReferenceMediaValidationError,
} from "./generation-reference-media.types.ts";

const generationReferenceMediaObjectPrefix = "generation-reference-media";

export function createGenerationReferenceMediaObjectKey({
  kind,
  mediaId,
  originalFileName,
  userId,
}: {
  userId: string;
  mediaId: string;
  kind: GenerationReferenceMediaKind;
  originalFileName: string;
}) {
  return ObjectStorageService.joinObjectKey(
    generationReferenceMediaObjectPrefix,
    "users",
    userId,
    kind,
    `${mediaId}${getSafeObjectExtension(originalFileName)}`,
  );
}

export function toStoredGenerationReferenceMedia({
  kind,
  mediaId,
  metadata,
  originalFileName,
  storedObject,
  userId,
}: {
  mediaId: string;
  userId: string;
  kind: GenerationReferenceMediaKind;
  originalFileName: string;
  metadata: StoredGenerationReferenceMedia["metadata"];
  storedObject: StoredObjectReference;
}): Omit<StoredGenerationReferenceMedia, "createdAt" | "updatedAt"> {
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

export const emptyGenerationReferenceMediaValue =
  generationReferenceMediaFieldIds.reduce((value, fieldId) => {
    value[fieldId] = [];
    return value;
  }, {} as GenerationThreadReferenceMediaValue);

export function createEmptyGenerationThreadReferenceMediaValue(): GenerationThreadReferenceMediaValue {
  return {
    images: [],
    videos: [],
    audios: [],
  };
}

export function isGenerationReferenceMediaFieldId(
  fieldId: string,
): fieldId is GenerationReferenceMediaFieldId {
  return (generationReferenceMediaFieldIds as readonly string[]).includes(
    fieldId,
  );
}

export function normalizeGenerationReferenceMediaInput(
  input: GenerationReferenceMediaInput | undefined,
): Record<GenerationReferenceMediaFieldId, string[]> {
  return {
    images: input?.images ?? [],
    videos: input?.videos ?? [],
    audios: input?.audios ?? [],
  };
}

export function getReferenceMediaKindForFieldId(
  fieldId: GenerationReferenceMediaFieldId,
): GenerationReferenceMediaKind {
  switch (fieldId) {
    case "images":
      return "image";
    case "videos":
      return "video";
    case "audios":
      return "audio";
  }
}

export function hasReferenceMedia(
  referenceMedia: GenerationThreadReferenceMediaValue | undefined,
) {
  if (!referenceMedia) {
    return false;
  }

  return Object.values(referenceMedia).some((items) => items.length > 0);
}

export function getReferenceMediaFieldSpec({
  fieldId,
  spec,
}: {
  fieldId: GenerationReferenceMediaFieldId;
  spec: VideoModelSpec;
}) {
  const field = spec.fields.find((candidate) => candidate.id === fieldId);

  if (
    !field ||
    field.componentKind !== "mediaList" ||
    field.valueKind !== "array"
  ) {
    throw new GenerationReferenceMediaValidationError(
      fieldId,
      `${fieldId} is not supported by this model`,
    );
  }

  return field;
}

export function validateReferenceMediaFileAgainstSpec({
  contentLength,
  contentType,
  field,
  metadata,
  originalFileName,
}: {
  contentLength: number | null;
  contentType: string | null;
  field: VideoFieldSpec;
  metadata: GenerationReferenceMediaMetadata;
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

export function validateReferenceMediaUploadAgainstKind({
  contentType,
  kind,
  metadata,
  originalFileName,
}: {
  contentType: string | null;
  kind: GenerationReferenceMediaKind;
  metadata: GenerationReferenceMediaMetadata;
  originalFileName: string;
}) {
  if (!matchesReferenceMediaKind({ contentType, kind, originalFileName })) {
    throw invalid("kind", `file does not match ${kind} reference media`);
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

export function validateReferenceMediaSelectionAgainstSpec({
  input,
  resolvedMedia,
  spec,
}: {
  input: Record<GenerationReferenceMediaFieldId, string[]>;
  resolvedMedia: StoredGenerationReferenceMedia[];
  spec: VideoModelSpec;
}) {
  const mediaById = new Map(resolvedMedia.map((media) => [media.id, media]));

  for (const fieldId of generationReferenceMediaFieldIds) {
    const ids = input[fieldId];

    if (ids.length === 0) {
      continue;
    }

    const field = getReferenceMediaFieldSpec({ fieldId, spec });
    const uniqueIds = new Set(ids);

    if (uniqueIds.size !== ids.length) {
      throw invalid(fieldId, "reference media cannot include duplicates");
    }

    if (field.arrayMax !== undefined && ids.length > field.arrayMax) {
      throw invalid(fieldId, `must include at most ${field.arrayMax} files`);
    }

    validateTotalDuration({
      field,
      media: ids.map((id) => {
        const item = mediaById.get(id);

        if (!item) {
          throw invalid(fieldId, "includes unavailable media");
        }

        if (item.kind !== getReferenceMediaKindForFieldId(fieldId)) {
          throw invalid(fieldId, `must include ${fieldId} reference media`);
        }

        validateReferenceMediaFileAgainstSpec({
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

  if (
    input.audios.length > 0 &&
    input.images.length === 0 &&
    input.videos.length === 0
  ) {
    throw invalid(
      "audios",
      "audio references require an image or video reference",
    );
  }
}

export function toThreadReferenceMediaValue(
  media: Array<
    StoredGenerationReferenceMedia & {
      fieldId: GenerationReferenceMediaFieldId;
      position?: number;
    }
  >,
): GenerationThreadReferenceMediaValue {
  const value = createEmptyGenerationThreadReferenceMediaValue();

  for (const item of [...media].sort(
    (left, right) => (left.position ?? 0) - (right.position ?? 0),
  )) {
    value[item.fieldId].push(toThreadReferenceMedia(item));
  }

  return value;
}

export function toThreadReferenceMedia(
  media: StoredGenerationReferenceMedia & {
    fieldId: GenerationReferenceMediaFieldId;
  },
): GenerationThreadReferenceMedia {
  return {
    id: media.id,
    kind: media.kind,
    fieldId: media.fieldId,
    originalFileName: media.originalFileName,
    contentType: media.contentType,
    contentLength: media.contentLength,
    metadata: media.metadata,
    createdAt: media.createdAt.toISOString(),
  };
}

function matchesReferenceMediaKind({
  contentType,
  kind,
  originalFileName,
}: {
  contentType: string | null;
  kind: GenerationReferenceMediaKind;
  originalFileName: string;
}) {
  const extension = getFileExtension(originalFileName);
  const extensions = referenceMediaExtensionsByKind[kind];

  if (extension && (extensions as readonly string[]).includes(extension)) {
    return true;
  }

  return contentType !== null && contentType.startsWith(`${kind}/`);
}

const referenceMediaExtensionsByKind = {
  image: [".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".webp"],
  video: [".avi", ".m4v", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg", ".webm"],
  audio: [".aac", ".aiff", ".flac", ".m4a", ".mp3", ".ogg", ".opus", ".wav"],
} as const satisfies Record<GenerationReferenceMediaKind, readonly string[]>;

export function flattenReferenceMediaInput(
  input: Record<GenerationReferenceMediaFieldId, string[]>,
) {
  return generationReferenceMediaFieldIds.flatMap((fieldId) =>
    input[fieldId].map((id, position) => ({
      id,
      fieldId,
      position,
    })),
  );
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
  metadata: GenerationReferenceMediaMetadata;
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
  metadata: GenerationReferenceMediaMetadata;
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
  metadata: GenerationReferenceMediaMetadata;
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
  media: StoredGenerationReferenceMedia[];
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
): GenerationReferenceMediaValidationError {
  return new GenerationReferenceMediaValidationError(field, message);
}
