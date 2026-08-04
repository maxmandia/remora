import { assertNever } from "@remora/utils";
import type { GenerationModelType } from "@remora/domain/generation-model/dto";
import type {
  GenerationSubmissionInput,
  ImageGenerationSubmissionInput,
  VideoGenerationSubmissionInput,
} from "@remora/domain/generation-submission/dto";
import {
  imageGenerationSubmissionInputSchema,
  videoGenerationSubmissionInputSchema,
} from "@remora/domain/generation-submission/validator";

import {
  ObjectStorageService,
  type StoredObjectReference,
} from "../storage/object-storage.service.ts";
import type {
  GenerationResultAssetKind,
  StoredGenerationDraftCacheReference,
  StoredGenerationResultAssetReference,
} from "./generation.types.ts";
import { GenerationSubmissionInputParseError } from "./generation.types.ts";

export function parseGenerationSubmissionInput(
  modelType: "video",
  input: unknown,
): VideoGenerationSubmissionInput;
export function parseGenerationSubmissionInput(
  modelType: "image",
  input: unknown,
): ImageGenerationSubmissionInput;
export function parseGenerationSubmissionInput(
  modelType: GenerationModelType,
  input: unknown,
): GenerationSubmissionInput;
export function parseGenerationSubmissionInput(
  modelType: GenerationModelType,
  input: unknown,
): GenerationSubmissionInput {
  const result =
    modelType === "video"
      ? videoGenerationSubmissionInputSchema.safeParse(input)
      : imageGenerationSubmissionInputSchema.safeParse(input);

  if (!result.success) {
    throw new GenerationSubmissionInputParseError(modelType, {
      cause: result.error,
    });
  }

  return result.data;
}

const generationResultAssetObjectPrefix = "generations";

export function createGenerationResultAssetObjectKey({
  kind,
  jobId,
}: {
  jobId: string;
  kind: GenerationResultAssetKind;
}) {
  switch (kind) {
    case "video":
      return ObjectStorageService.joinObjectKey(
        generationResultAssetObjectPrefix,
        "jobs",
        jobId,
        "video.mp4",
      );
    case "image":
      return ObjectStorageService.joinObjectKey(
        generationResultAssetObjectPrefix,
        "jobs",
        jobId,
        "image",
      );
    default:
      return assertNever(kind);
  }
}

export function createGeneratedImageFilename({
  contentType,
  jobId,
}: {
  contentType: string | null;
  jobId: string;
}) {
  const safeJobId = jobId.replace(/[^A-Za-z0-9_-]/g, "_");
  const extension = getImageExtension(contentType);

  return `remora-image-${safeJobId}${extension ? `.${extension}` : ""}`;
}

function getImageExtension(contentType: string | null) {
  switch (contentType?.split(";")[0]?.trim().toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/bmp":
      return "bmp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return null;
  }
}

export function createGenerationResultPreviewObjectKey({
  jobId,
}: {
  jobId: string;
}) {
  return ObjectStorageService.joinObjectKey(
    generationResultAssetObjectPrefix,
    "jobs",
    jobId,
    "preview.jpg",
  );
}

export function createGenerationDraftCacheObjectKey({
  jobId,
}: {
  jobId: string;
}) {
  return ObjectStorageService.joinObjectKey(
    generationResultAssetObjectPrefix,
    "jobs",
    jobId,
    "draft-cache",
  );
}

export function toStoredGenerationDraftCacheReference({
  sourceProviderUrl,
  storedObject,
}: {
  sourceProviderUrl: string;
  storedObject: StoredObjectReference;
}): StoredGenerationDraftCacheReference {
  return {
    bucket: storedObject.bucket,
    objectKey: storedObject.objectKey,
    contentType: storedObject.contentType,
    contentLength: storedObject.contentLength,
    etag: storedObject.etag,
    checksumSha256: storedObject.checksumSha256,
    sourceProviderUrl,
  };
}

export function toStoredGenerationResultAssetReference({
  kind,
  sourceProviderUrl,
  storedObject,
}: {
  kind: GenerationResultAssetKind;
  sourceProviderUrl: string | null;
  storedObject: StoredObjectReference;
}): StoredGenerationResultAssetReference {
  return {
    kind,
    bucket: storedObject.bucket,
    objectKey: storedObject.objectKey,
    contentType: storedObject.contentType,
    contentLength: storedObject.contentLength,
    etag: storedObject.etag,
    checksumSha256: storedObject.checksumSha256,
    sourceProviderUrl,
  };
}
