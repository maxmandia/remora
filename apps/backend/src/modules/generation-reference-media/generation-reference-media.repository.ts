import { and, asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema } from "../../db/client.ts";
import { toThreadReferenceMediaValue } from "./generation-reference-media.utils.ts";
import type {
  GenerationThreadReferenceMediaValue,
  StoredGenerationReferenceMedia,
  StoredGenerationReferenceMediaWithPosition,
} from "./generation-reference-media.types.ts";

type NewStoredGenerationReferenceMedia = Omit<
  StoredGenerationReferenceMedia,
  "createdAt" | "updatedAt"
>;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ReferenceMediaAttachTarget = {
  id: string;
  referenceMedia: GenerationThreadReferenceMediaValue;
};

export class GenerationReferenceMediaRepository {
  async insertGenerationReferenceMedia(
    media: NewStoredGenerationReferenceMedia,
  ): Promise<StoredGenerationReferenceMedia> {
    const [row] = await db
      .insert(schema.generationReferenceMedia)
      .values(media)
      .returning();

    if (!row) {
      throw new Error("Generation reference media was not created");
    }

    return row;
  }

  async listGenerationReferenceMediaByIdsForUser({
    ids,
    userId,
  }: {
    userId: string;
    ids: string[];
  }): Promise<StoredGenerationReferenceMedia[]> {
    if (ids.length === 0) {
      return [];
    }

    return db
      .select()
      .from(schema.generationReferenceMedia)
      .where(
        and(
          eq(schema.generationReferenceMedia.userId, userId),
          inArray(schema.generationReferenceMedia.id, ids),
        ),
      );
  }

  async listReferenceMediaForSubmission(
    submissionId: string,
  ): Promise<StoredGenerationReferenceMediaWithPosition[]> {
    const rows = await db
      .select({
        submissionId: schema.generationSubmissionReferenceMedia.submissionId,
        position: schema.generationSubmissionReferenceMedia.position,
        id: schema.generationReferenceMedia.id,
        userId: schema.generationReferenceMedia.userId,
        kind: schema.generationReferenceMedia.kind,
        fieldId: schema.generationSubmissionReferenceMedia.fieldId,
        originalFileName: schema.generationReferenceMedia.originalFileName,
        bucket: schema.generationReferenceMedia.bucket,
        objectKey: schema.generationReferenceMedia.objectKey,
        contentType: schema.generationReferenceMedia.contentType,
        contentLength: schema.generationReferenceMedia.contentLength,
        etag: schema.generationReferenceMedia.etag,
        checksumSha256: schema.generationReferenceMedia.checksumSha256,
        metadata: schema.generationReferenceMedia.metadata,
        createdAt: schema.generationReferenceMedia.createdAt,
        updatedAt: schema.generationReferenceMedia.updatedAt,
      })
      .from(schema.generationSubmissionReferenceMedia)
      .innerJoin(
        schema.generationReferenceMedia,
        eq(
          schema.generationReferenceMedia.id,
          schema.generationSubmissionReferenceMedia.referenceMediaId,
        ),
      )
      .where(
        eq(
          schema.generationSubmissionReferenceMedia.submissionId,
          submissionId,
        ),
      )
      .orderBy(
        asc(schema.generationSubmissionReferenceMedia.fieldId),
        asc(schema.generationSubmissionReferenceMedia.position),
      );

    return rows.map(({ submissionId: _submissionId, ...row }) => row);
  }

  async listReferenceMediaFromSubmission({
    submissionId,
    userId,
  }: {
    submissionId: string;
    userId: string;
  }): Promise<StoredGenerationReferenceMediaWithPosition[]> {
    const submission = await db.query.generationSubmission.findFirst({
      columns: {
        id: true,
      },
      where: (submission, { and, eq }) =>
        and(eq(submission.id, submissionId), eq(submission.userId, userId)),
      with: {
        referenceMedia: {
          columns: {
            fieldId: true,
            position: true,
          },
          orderBy: (referenceMedia, { asc }) => [
            asc(referenceMedia.fieldId),
            asc(referenceMedia.position),
          ],
          with: {
            referenceMedia: true,
          },
        },
      },
    });

    return (
      submission?.referenceMedia
        .filter(({ referenceMedia }) => referenceMedia.userId === userId)
        .map(({ fieldId, position, referenceMedia }) => ({
          ...referenceMedia,
          fieldId,
          position,
        })) ?? []
    );
  }

  async attachReferenceMediaToSubmission(
    tx: DatabaseTransaction,
    submissionId: string,
    media: StoredGenerationReferenceMediaWithPosition[],
  ): Promise<void> {
    if (media.length === 0) {
      return;
    }

    await tx.insert(schema.generationSubmissionReferenceMedia).values(
      media.map((item) => ({
        id: randomUUID(),
        submissionId,
        referenceMediaId: item.id,
        fieldId: item.fieldId,
        position: item.position,
      })),
    );
  }

  async attachReferenceMediaToSubmissions(
    submissions: ReferenceMediaAttachTarget[],
  ): Promise<void> {
    if (submissions.length === 0) {
      return;
    }

    const rows = await db
      .select({
        submissionId: schema.generationSubmissionReferenceMedia.submissionId,
        position: schema.generationSubmissionReferenceMedia.position,
        id: schema.generationReferenceMedia.id,
        userId: schema.generationReferenceMedia.userId,
        kind: schema.generationReferenceMedia.kind,
        fieldId: schema.generationSubmissionReferenceMedia.fieldId,
        originalFileName: schema.generationReferenceMedia.originalFileName,
        bucket: schema.generationReferenceMedia.bucket,
        objectKey: schema.generationReferenceMedia.objectKey,
        contentType: schema.generationReferenceMedia.contentType,
        contentLength: schema.generationReferenceMedia.contentLength,
        etag: schema.generationReferenceMedia.etag,
        checksumSha256: schema.generationReferenceMedia.checksumSha256,
        metadata: schema.generationReferenceMedia.metadata,
        createdAt: schema.generationReferenceMedia.createdAt,
        updatedAt: schema.generationReferenceMedia.updatedAt,
      })
      .from(schema.generationSubmissionReferenceMedia)
      .innerJoin(
        schema.generationReferenceMedia,
        eq(
          schema.generationReferenceMedia.id,
          schema.generationSubmissionReferenceMedia.referenceMediaId,
        ),
      )
      .where(
        inArray(
          schema.generationSubmissionReferenceMedia.submissionId,
          submissions.map((submission) => submission.id),
        ),
      )
      .orderBy(
        asc(schema.generationSubmissionReferenceMedia.submissionId),
        asc(schema.generationSubmissionReferenceMedia.fieldId),
        asc(schema.generationSubmissionReferenceMedia.position),
      );
    const mediaBySubmissionId = new Map<
      string,
      StoredGenerationReferenceMediaWithPosition[]
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
      submission.referenceMedia = toThreadReferenceMediaValue(
        mediaBySubmissionId.get(submission.id) ?? [],
      );
    }
  }
}

export const generationReferenceMediaRepository =
  new GenerationReferenceMediaRepository();
