import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import type { VideoModelSpec } from "../model/types.ts";
import {
  objectStorageService,
  type SignedObjectUrl,
  type StoredObjectReference,
} from "../storage/object-storage.service.ts";
import {
  FfprobeMediaMetadataProbe,
  type MediaMetadataProbe,
} from "./generation-media-probe.service.ts";
import type { GenerationReferenceMediaRepository } from "./generation-reference-media.repository.ts";
import { generationReferenceMediaRepository } from "./generation-reference-media.repository.ts";
import type {
  GenerationReferenceMediaInput,
  GenerationReferenceMediaMetadata,
  GenerationReferenceMediaUploadInput,
  GenerationReferenceMediaUploadResult,
  SignedGenerationReferenceMedia,
  StoredGenerationReferenceMediaWithPosition,
} from "./generation-reference-media.types.ts";
import { GenerationReferenceMediaValidationError } from "./generation-reference-media.types.ts";
import {
  createGenerationReferenceMediaObjectKey,
  flattenReferenceMediaInput,
  normalizeGenerationReferenceMediaInput,
  toStoredGenerationReferenceMedia,
  validateReferenceMediaSelectionAgainstSpec,
  validateReferenceMediaUploadAgainstKind,
} from "./generation-reference-media.utils.ts";

type ObjectStorageReadWriter = {
  createSignedGetUrlWithExpiration(reference: {
    bucket: string;
    objectKey: string;
  }): Promise<SignedObjectUrl>;
  uploadObject(input: {
    objectKey: string;
    body: NodeJS.ReadableStream;
    contentLength: number | null;
    contentType: string | null;
  }): Promise<StoredObjectReference>;
};

export class GenerationReferenceMediaService {
  constructor(
    private readonly repository: GenerationReferenceMediaRepository = generationReferenceMediaRepository,
    private readonly storage: ObjectStorageReadWriter = objectStorageService,
    private readonly mediaMetadataProbe: MediaMetadataProbe = new FfprobeMediaMetadataProbe(),
  ) {}

  async uploadGenerationReferenceMedia(
    input: GenerationReferenceMediaUploadInput,
  ): Promise<GenerationReferenceMediaUploadResult> {
    const mediaId = randomUUID();
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "remora-reference-media-"),
    );
    const tempFilePath = path.join(tempDir, "upload");
    const contentType = normalizeNullableString(input.contentType);

    try {
      await pipeline(input.body, createWriteStream(tempFilePath));

      const fileStat = await stat(tempFilePath);
      const contentLength = fileStat.size;
      let metadata: GenerationReferenceMediaMetadata;

      try {
        metadata = await this.mediaMetadataProbe.probe(tempFilePath);
      } catch {
        throw new GenerationReferenceMediaValidationError(
          "kind",
          "reference media could not be inspected",
        );
      }

      validateReferenceMediaUploadAgainstKind({
        contentType,
        kind: input.kind,
        metadata,
        originalFileName: input.originalFileName,
      });

      const storedObject = await this.storage.uploadObject({
        objectKey: createGenerationReferenceMediaObjectKey({
          userId: input.userId,
          mediaId,
          kind: input.kind,
          originalFileName: input.originalFileName,
        }),
        body: createReadStream(tempFilePath),
        contentLength,
        contentType,
      });
      const storedReferenceMedia =
        await this.repository.insertGenerationReferenceMedia(
          toStoredGenerationReferenceMedia({
            mediaId,
            userId: input.userId,
            kind: input.kind,
            originalFileName: input.originalFileName,
            metadata,
            storedObject,
          }),
        );

      return {
        id: storedReferenceMedia.id,
        kind: storedReferenceMedia.kind,
        originalFileName: storedReferenceMedia.originalFileName,
        contentType: storedReferenceMedia.contentType,
        contentLength: storedReferenceMedia.contentLength,
        metadata: storedReferenceMedia.metadata,
      };
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  async resolveSelectionForSubmission({
    input,
    spec,
    userId,
  }: {
    userId: string;
    input: GenerationReferenceMediaInput | undefined;
    spec: VideoModelSpec;
  }): Promise<StoredGenerationReferenceMediaWithPosition[]> {
    const normalized = normalizeGenerationReferenceMediaInput(input);
    const requestedMedia = flattenReferenceMediaInput(normalized);

    if (requestedMedia.length === 0) {
      return [];
    }

    const media =
      await this.repository.listGenerationReferenceMediaByIdsForUser({
        userId,
        ids: requestedMedia.map((item) => item.id),
      });
    const mediaById = new Map(media.map((item) => [item.id, item]));
    const orderedMedia = requestedMedia.map(({ fieldId, id, position }) => {
      const item = mediaById.get(id);

      if (!item) {
        throw new GenerationReferenceMediaValidationError(
          fieldId,
          "reference media was not found",
        );
      }

      return {
        ...item,
        fieldId,
        position,
      };
    });

    validateReferenceMediaSelectionAgainstSpec({
      input: normalized,
      resolvedMedia: orderedMedia,
      spec,
    });

    return orderedMedia;
  }

  async prepareSignedReferenceMediaForSubmission({
    submissionId,
  }: {
    submissionId: string;
  }): Promise<SignedGenerationReferenceMedia[]> {
    const referenceMedia =
      await this.repository.listReferenceMediaForSubmission(submissionId);
    const signedReferenceMedia: SignedGenerationReferenceMedia[] = [];

    for (const media of referenceMedia) {
      const signedUrl = await this.storage.createSignedGetUrlWithExpiration({
        bucket: media.bucket,
        objectKey: media.objectKey,
      });

      signedReferenceMedia.push({
        fieldId: media.fieldId,
        url: signedUrl.url,
      });
    }

    return signedReferenceMedia;
  }
}

export const generationReferenceMediaService =
  new GenerationReferenceMediaService();

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";

  return normalized.length > 0 ? normalized : null;
}
