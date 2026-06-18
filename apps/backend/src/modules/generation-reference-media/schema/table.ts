import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";
import { generationSubmission } from "../../generation/schema/table.ts";

import type {
  GenerationReferenceMediaFieldId,
  GenerationReferenceMediaKind,
  GenerationReferenceMediaMetadata,
} from "../generation-reference-media.types.ts";

export const generationReferenceMedia = pgTable(
  "generation_reference_media",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<GenerationReferenceMediaKind>().notNull(),
    originalFileName: text("original_file_name").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type"),
    contentLength: bigint("content_length", { mode: "number" }),
    etag: text("etag"),
    checksumSha256: text("checksum_sha256"),
    metadata: jsonb("metadata")
      .$type<GenerationReferenceMediaMetadata>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_reference_media_user_id_idx").on(table.userId),
    index("generation_reference_media_user_id_kind_idx").on(
      table.userId,
      table.kind,
    ),
    index("generation_reference_media_bucket_object_key_idx").on(
      table.bucket,
      table.objectKey,
    ),
  ],
);

export const generationSubmissionReferenceMedia = pgTable(
  "generation_submission_reference_media",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => generationSubmission.id, { onDelete: "cascade" }),
    referenceMediaId: text("reference_media_id")
      .notNull()
      .references(() => generationReferenceMedia.id, { onDelete: "restrict" }),
    fieldId: text("field_id")
      .$type<GenerationReferenceMediaFieldId>()
      .notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("generation_submission_reference_media_submission_id_idx").on(
      table.submissionId,
    ),
    index("generation_submission_reference_media_reference_media_id_idx").on(
      table.referenceMediaId,
    ),
    uniqueIndex(
      "generation_submission_reference_media_submission_media_idx",
    ).on(table.submissionId, table.referenceMediaId),
    uniqueIndex(
      "generation_submission_reference_media_submission_field_position_idx",
    ).on(table.submissionId, table.fieldId, table.position),
  ],
);
