import { and, asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema } from "../../db/client.ts";
import { toThreadAttachmentMediaValue } from "./generation-attachment-media.utils.ts";
import type {
  GenerationThreadAttachmentMediaValue,
  StoredGenerationAttachmentMedia,
  StoredGenerationAttachmentMediaWithPosition,
} from "./generation-attachment-media.types.ts";

type NewStoredGenerationAttachmentMedia = Omit<
  StoredGenerationAttachmentMedia,
  "createdAt" | "updatedAt"
>;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AttachmentMediaAttachTarget = {
  id: string;
  attachmentMedia: GenerationThreadAttachmentMediaValue;
};

export class GenerationAttachmentMediaRepository {
  async insertGenerationAttachmentMedia(
    media: NewStoredGenerationAttachmentMedia,
  ): Promise<StoredGenerationAttachmentMedia> {
    const [row] = await db
      .insert(schema.generationAttachmentMedia)
      .values(media)
      .returning();

    if (!row) {
      throw new Error("Generation attachment media was not created");
    }

    return row;
  }

  async listGenerationAttachmentMediaByIdsForUser({
    ids,
    userId,
  }: {
    userId: string;
    ids: string[];
  }): Promise<StoredGenerationAttachmentMedia[]> {
    if (ids.length === 0) {
      return [];
    }

    return db
      .select()
      .from(schema.generationAttachmentMedia)
      .where(
        and(
          eq(schema.generationAttachmentMedia.userId, userId),
          inArray(schema.generationAttachmentMedia.id, ids),
        ),
      );
  }

  async listAttachmentMediaForSubmission(
    submissionId: string,
  ): Promise<StoredGenerationAttachmentMediaWithPosition[]> {
    const rows = await db
      .select({
        submissionId: schema.generationSubmissionAttachmentMedia.submissionId,
        position: schema.generationSubmissionAttachmentMedia.position,
        id: schema.generationAttachmentMedia.id,
        userId: schema.generationAttachmentMedia.userId,
        kind: schema.generationAttachmentMedia.kind,
        fieldId: schema.generationSubmissionAttachmentMedia.fieldId,
        originalFileName: schema.generationAttachmentMedia.originalFileName,
        bucket: schema.generationAttachmentMedia.bucket,
        objectKey: schema.generationAttachmentMedia.objectKey,
        contentType: schema.generationAttachmentMedia.contentType,
        contentLength: schema.generationAttachmentMedia.contentLength,
        etag: schema.generationAttachmentMedia.etag,
        checksumSha256: schema.generationAttachmentMedia.checksumSha256,
        metadata: schema.generationAttachmentMedia.metadata,
        createdAt: schema.generationAttachmentMedia.createdAt,
        updatedAt: schema.generationAttachmentMedia.updatedAt,
      })
      .from(schema.generationSubmissionAttachmentMedia)
      .innerJoin(
        schema.generationAttachmentMedia,
        eq(
          schema.generationAttachmentMedia.id,
          schema.generationSubmissionAttachmentMedia.attachmentMediaId,
        ),
      )
      .where(
        eq(
          schema.generationSubmissionAttachmentMedia.submissionId,
          submissionId,
        ),
      )
      .orderBy(
        asc(schema.generationSubmissionAttachmentMedia.fieldId),
        asc(schema.generationSubmissionAttachmentMedia.position),
      );

    return rows.map(({ submissionId: _submissionId, ...row }) => row);
  }

  async listAttachmentMediaFromSubmission({
    submissionId,
    userId,
  }: {
    submissionId: string;
    userId: string;
  }): Promise<StoredGenerationAttachmentMediaWithPosition[]> {
    const submission = await db.query.generationSubmission.findFirst({
      columns: {
        id: true,
      },
      where: (submission, { and, eq }) =>
        and(eq(submission.id, submissionId), eq(submission.userId, userId)),
      with: {
        attachmentMedia: {
          columns: {
            fieldId: true,
            position: true,
          },
          orderBy: (attachmentMedia, { asc }) => [
            asc(attachmentMedia.fieldId),
            asc(attachmentMedia.position),
          ],
          with: {
            attachmentMedia: true,
          },
        },
      },
    });

    return (
      submission?.attachmentMedia
        .filter(({ attachmentMedia }) => attachmentMedia.userId === userId)
        .map(({ fieldId, position, attachmentMedia }) => ({
          ...attachmentMedia,
          fieldId,
          position,
        })) ?? []
    );
  }

  async attachAttachmentMediaToSubmission(
    tx: DatabaseTransaction,
    submissionId: string,
    media: StoredGenerationAttachmentMediaWithPosition[],
  ): Promise<void> {
    if (media.length === 0) {
      return;
    }

    await tx.insert(schema.generationSubmissionAttachmentMedia).values(
      media.map((item) => ({
        id: randomUUID(),
        submissionId,
        attachmentMediaId: item.id,
        fieldId: item.fieldId,
        position: item.position,
      })),
    );
  }

  async attachAttachmentMediaToSubmissions(
    submissions: AttachmentMediaAttachTarget[],
  ): Promise<void> {
    if (submissions.length === 0) {
      return;
    }

    const rows = await db
      .select({
        submissionId: schema.generationSubmissionAttachmentMedia.submissionId,
        position: schema.generationSubmissionAttachmentMedia.position,
        id: schema.generationAttachmentMedia.id,
        userId: schema.generationAttachmentMedia.userId,
        kind: schema.generationAttachmentMedia.kind,
        fieldId: schema.generationSubmissionAttachmentMedia.fieldId,
        originalFileName: schema.generationAttachmentMedia.originalFileName,
        bucket: schema.generationAttachmentMedia.bucket,
        objectKey: schema.generationAttachmentMedia.objectKey,
        contentType: schema.generationAttachmentMedia.contentType,
        contentLength: schema.generationAttachmentMedia.contentLength,
        etag: schema.generationAttachmentMedia.etag,
        checksumSha256: schema.generationAttachmentMedia.checksumSha256,
        metadata: schema.generationAttachmentMedia.metadata,
        createdAt: schema.generationAttachmentMedia.createdAt,
        updatedAt: schema.generationAttachmentMedia.updatedAt,
      })
      .from(schema.generationSubmissionAttachmentMedia)
      .innerJoin(
        schema.generationAttachmentMedia,
        eq(
          schema.generationAttachmentMedia.id,
          schema.generationSubmissionAttachmentMedia.attachmentMediaId,
        ),
      )
      .where(
        inArray(
          schema.generationSubmissionAttachmentMedia.submissionId,
          submissions.map((submission) => submission.id),
        ),
      )
      .orderBy(
        asc(schema.generationSubmissionAttachmentMedia.submissionId),
        asc(schema.generationSubmissionAttachmentMedia.fieldId),
        asc(schema.generationSubmissionAttachmentMedia.position),
      );
    const mediaBySubmissionId = new Map<
      string,
      StoredGenerationAttachmentMediaWithPosition[]
    >();

    for (const row of rows) {
      if (!row.id) {
        continue;
      }

      const media = mediaBySubmissionId.get(row.submissionId) ?? [];
      media.push({
        id: row.id,
        userId: row.userId,
        kind: row.kind,
        fieldId: row.fieldId,
        originalFileName: row.originalFileName,
        bucket: row.bucket,
        objectKey: row.objectKey,
        contentType: row.contentType,
        contentLength: row.contentLength,
        etag: row.etag,
        checksumSha256: row.checksumSha256,
        metadata: row.metadata,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        position: row.position,
      });
      mediaBySubmissionId.set(row.submissionId, media);
    }

    for (const submission of submissions) {
      submission.attachmentMedia = toThreadAttachmentMediaValue(
        mediaBySubmissionId.get(submission.id) ?? [],
      );
    }
  }
}

export const generationAttachmentMediaRepository =
  new GenerationAttachmentMediaRepository();
