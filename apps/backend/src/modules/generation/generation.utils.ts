import { assertNever } from "@remora/utils";

import {
  ObjectStorageService,
  type StoredObjectReference,
} from "../storage/object-storage.service.ts";
import type {
  GenerationResultAssetKind,
  StoredGenerationResultAssetReference,
} from "./generation.types.ts";

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
