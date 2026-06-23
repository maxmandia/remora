import { and, asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
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

type AttachmentMediaAttachTarget = {
  id: string;
  attachmentMedia: GenerationThreadAttachmentMediaValue;
};

export class GenerationAttachmentMediaRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async insertGenerationAttachmentMedia(
    media: NewStoredGenerationAttachmentMedia,
  ): Promise<StoredGenerationAttachmentMedia> {
    const [row] = await this.executor
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

    return this.executor
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
    const rows = await this.executor
      .select({
        submissionId: schema.generationSubmissionAttachmentMedia.submissionId,
        position: schema.generationSubmissionAttachmentMedia.position,
        id: schema.generationAttachmentMedia.id,
        userId: schema.generationAttachmentMedia.userId,
        kind: schema.generationAttachmentMedia.kind,
        fieldId: schema.generationSubmissionAttachmentMedia.fieldId,
        role: schema.generationSubmissionAttachmentMedia.role,
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
    const submission = await this.executor.query.generationSubmission.findFirst({
      columns: {
        id: true,
      },
      where: (submission, { and, eq }) =>
        and(eq(submission.id, submissionId), eq(submission.userId, userId)),
      with: {
        attachmentMedia: {
          columns: {
            fieldId: true,
            role: true,
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
        .map(({ fieldId, role, position, attachmentMedia }) => ({
          ...attachmentMedia,
          fieldId,
          role,
          position,
        })) ?? []
    );
  }

  async attachAttachmentMediaToSubmission(
    submissionId: string,
    media: StoredGenerationAttachmentMediaWithPosition[],
  ): Promise<void> {
    if (media.length === 0) {
      return;
    }

    await this.executor
      .insert(schema.generationSubmissionAttachmentMedia)
      .values(
        media.map((item) => ({
          id: randomUUID(),
          submissionId,
          attachmentMediaId: item.id,
          fieldId: item.fieldId,
          role: item.role,
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

    const rows = await this.executor
      .select({
        submissionId: schema.generationSubmissionAttachmentMedia.submissionId,
        position: schema.generationSubmissionAttachmentMedia.position,
        id: schema.generationAttachmentMedia.id,
        userId: schema.generationAttachmentMedia.userId,
        kind: schema.generationAttachmentMedia.kind,
        fieldId: schema.generationSubmissionAttachmentMedia.fieldId,
        role: schema.generationSubmissionAttachmentMedia.role,
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
        role: row.role,
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
