import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import type { VideoModelSpec } from "../model/model.types.ts";
import {
  objectStorageService,
  type SignedObjectUrl,
  type StoredObjectReference,
} from "../storage/object-storage.service.ts";
import type { GenerationAttachmentMediaRepository } from "./generation-attachment-media.repository.ts";
import { generationAttachmentMediaRepository } from "./generation-attachment-media.repository.ts";
import type {
  GenerationAttachmentMediaInput,
  GenerationAttachmentMediaMetadata,
  GenerationAttachmentMediaUploadInput,
  GenerationAttachmentMediaUploadResult,
  SignedGenerationAttachmentMedia,
  SignedGenerationThreadAttachmentMedia,
  StoredGenerationAttachmentMediaWithPosition,
} from "./generation-attachment-media.types.ts";
import {
  generationAttachmentMediaFieldIds,
  GenerationAttachmentMediaValidationError,
} from "./generation-attachment-media.types.ts";
import {
  createGenerationAttachmentMediaObjectKey,
  flattenAttachmentMediaInput,
  normalizeGenerationAttachmentMediaInput,
  toStoredGenerationAttachmentMedia,
  toThreadAttachmentMedia,
  validateAttachmentMediaSelectionAgainstSpec,
  validateAttachmentMediaUploadAgainstKind,
} from "./generation-attachment-media.utils.ts";
import {
  FfprobeMediaMetadataProbe,
  type MediaMetadataProbe,
} from "./generation-media-probe.service.ts";

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

export class GenerationAttachmentMediaService {
  constructor(
    private readonly repository: GenerationAttachmentMediaRepository = generationAttachmentMediaRepository,
    private readonly storage: ObjectStorageReadWriter = objectStorageService,
    private readonly mediaMetadataProbe: MediaMetadataProbe = new FfprobeMediaMetadataProbe(),
  ) {}

  async uploadGenerationAttachmentMedia(
    input: GenerationAttachmentMediaUploadInput,
  ): Promise<GenerationAttachmentMediaUploadResult> {
    const mediaId = randomUUID();
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "remora-attachment-media-"),
    );
    const tempFilePath = path.join(tempDir, "upload");
    const contentType = normalizeNullableString(input.contentType);

    try {
      await pipeline(input.body, createWriteStream(tempFilePath));

      const fileStat = await stat(tempFilePath);
      const contentLength = fileStat.size;
      let metadata: GenerationAttachmentMediaMetadata;

      try {
        metadata = await this.mediaMetadataProbe.probe(tempFilePath);
      } catch {
        throw new GenerationAttachmentMediaValidationError(
          "kind",
          "attachment media could not be inspected",
        );
      }

      validateAttachmentMediaUploadAgainstKind({
        contentType,
        kind: input.kind,
        metadata,
        originalFileName: input.originalFileName,
      });

      const storedObject = await this.storage.uploadObject({
        objectKey: createGenerationAttachmentMediaObjectKey({
          userId: input.userId,
          mediaId,
          kind: input.kind,
          originalFileName: input.originalFileName,
        }),
        body: createReadStream(tempFilePath),
        contentLength,
        contentType,
      });
      const storedAttachmentMedia =
        await this.repository.insertGenerationAttachmentMedia(
          toStoredGenerationAttachmentMedia({
            mediaId,
            userId: input.userId,
            kind: input.kind,
            originalFileName: input.originalFileName,
            metadata,
            storedObject,
          }),
        );

      return {
        id: storedAttachmentMedia.id,
        kind: storedAttachmentMedia.kind,
        originalFileName: storedAttachmentMedia.originalFileName,
        contentType: storedAttachmentMedia.contentType,
        contentLength: storedAttachmentMedia.contentLength,
        metadata: storedAttachmentMedia.metadata,
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
    input: GenerationAttachmentMediaInput | undefined;
    spec: VideoModelSpec;
  }): Promise<StoredGenerationAttachmentMediaWithPosition[]> {
    const normalized = normalizeGenerationAttachmentMediaInput(input);
    const requestedMedia = flattenAttachmentMediaInput(normalized);

    if (requestedMedia.length === 0) {
      return [];
    }

    const media =
      await this.repository.listGenerationAttachmentMediaByIdsForUser({
        userId,
        ids: requestedMedia.map((item) => item.id),
      });
    const mediaById = new Map(media.map((item) => [item.id, item]));
    const orderedMedia = requestedMedia.map(
      ({ fieldId, id, position, role }) => {
        const item = mediaById.get(id);

        if (!item) {
          throw new GenerationAttachmentMediaValidationError(
            fieldId,
            "attachment media was not found",
          );
        }

        return {
          ...item,
          fieldId,
          role,
          position,
        };
      },
    );

    validateAttachmentMediaSelectionAgainstSpec({
      input: normalized,
      resolvedMedia: orderedMedia,
      spec,
    });

    return orderedMedia;
  }

  async prepareSignedAttachmentMediaForSubmission({
    submissionId,
  }: {
    submissionId: string;
  }): Promise<SignedGenerationAttachmentMedia[]> {
    const attachmentMedia =
      await this.repository.listAttachmentMediaForSubmission(submissionId);
    const signedAttachmentMedia: SignedGenerationAttachmentMedia[] = [];

    for (const media of attachmentMedia) {
      const signedUrl = await this.storage.createSignedGetUrlWithExpiration({
        bucket: media.bucket,
        objectKey: media.objectKey,
      });

      signedAttachmentMedia.push({
        fieldId: media.fieldId,
        role: media.role,
        url: signedUrl.url,
      });
    }

    return signedAttachmentMedia;
  }

  async listSignedAttachmentMediaFromSubmission({
    submissionId,
    userId,
  }: {
    submissionId: string;
    userId: string;
  }): Promise<SignedGenerationThreadAttachmentMedia[]> {
    const attachmentMedia =
      await this.repository.listAttachmentMediaFromSubmission({
        submissionId,
        userId,
      });
    const orderedAttachmentMedia =
      orderAttachmentMediaForDisplay(attachmentMedia);
    const signedAttachmentMedia: SignedGenerationThreadAttachmentMedia[] = [];

    for (const media of orderedAttachmentMedia) {
      const signedUrl = await this.storage.createSignedGetUrlWithExpiration({
        bucket: media.bucket,
        objectKey: media.objectKey,
      });

      signedAttachmentMedia.push({
        ...toThreadAttachmentMedia(media),
        url: signedUrl.url,
        urlExpiresAt: signedUrl.expiresAt,
      });
    }

    return signedAttachmentMedia;
  }
}

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";

  return normalized.length > 0 ? normalized : null;
}

function orderAttachmentMediaForDisplay(
  media: StoredGenerationAttachmentMediaWithPosition[],
) {
  const fieldOrderById = new Map(
    generationAttachmentMediaFieldIds.map((fieldId, index) => [fieldId, index]),
  );

  return [...media].sort((left, right) => {
    const leftFieldOrder = fieldOrderById.get(left.fieldId) ?? 0;
    const rightFieldOrder = fieldOrderById.get(right.fieldId) ?? 0;

    if (leftFieldOrder !== rightFieldOrder) {
      return leftFieldOrder - rightFieldOrder;
    }

    return left.position - right.position;
  });
}
