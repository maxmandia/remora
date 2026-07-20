import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { attachmentMediaRoles as domainAttachmentMediaRoles } from "@remora/domain/generation-attachment-media/dto";
export type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";

import { user } from "../../auth/schema/table.ts";
import { generationSubmission } from "../../generation/schema/table.ts";

import type {
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaMetadata,
} from "../generation-attachment-media.types.ts";

export const generationAttachmentMediaRole = pgEnum(
  "generation_attachment_media_role",
  domainAttachmentMediaRoles,
);

export const attachmentMediaRoles = generationAttachmentMediaRole.enumValues;

export const generationAttachmentMedia = pgTable(
  "generation_attachment_media",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<GenerationAttachmentMediaKind>().notNull(),
    originalFileName: text("original_file_name").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type"),
    contentLength: bigint("content_length", { mode: "number" }),
    etag: text("etag"),
    checksumSha256: text("checksum_sha256"),
    metadata: jsonb("metadata")
      .$type<GenerationAttachmentMediaMetadata>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_attachment_media_user_id_idx").on(table.userId),
    index("generation_attachment_media_user_id_kind_idx").on(
      table.userId,
      table.kind,
    ),
    index("generation_attachment_media_bucket_object_key_idx").on(
      table.bucket,
      table.objectKey,
    ),
  ],
);

export const generationSubmissionAttachmentMedia = pgTable(
  "generation_submission_attachment_media",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => generationSubmission.id, { onDelete: "cascade" }),
    attachmentMediaId: text("attachment_media_id")
      .notNull()
      .references(() => generationAttachmentMedia.id, { onDelete: "restrict" }),
    fieldId: text("field_id")
      .$type<GenerationAttachmentMediaFieldId>()
      .notNull(),
    role: generationAttachmentMediaRole("role").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("generation_submission_attachment_media_submission_id_idx").on(
      table.submissionId,
    ),
    index("generation_submission_attachment_media_attachment_media_id_idx").on(
      table.attachmentMediaId,
    ),
    uniqueIndex(
      "generation_submission_attachment_media_submission_media_idx",
    ).on(table.submissionId, table.attachmentMediaId),
    uniqueIndex(
      "generation_submission_attachment_media_submission_field_position_idx",
    ).on(table.submissionId, table.fieldId, table.position),
  ],
);
