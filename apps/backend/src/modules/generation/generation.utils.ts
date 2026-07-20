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

export function toStoredGenerationResultAssetReference({
  kind,
  sourceProviderUrl,
  storedObject,
}: {
  kind: GenerationResultAssetKind;
  sourceProviderUrl: string;
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
