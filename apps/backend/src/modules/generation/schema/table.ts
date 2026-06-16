import {
  bigint,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";
import {
  generationModel,
  generationModelSpec,
  generationProvider,
} from "../../model/schema/table.ts";
import { project } from "../../project/schema/table.ts";

import type {
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationResultAssetKind,
  GenerationSubmissionInput,
  SeedanceProviderError,
  SeedanceProviderStatus,
  SeedanceUsage,
} from "../generation.types.ts";

export const generationJobStatus = pgEnum("generation_job_status", [
  "queued",
  "creating_provider_task",
  "provider_task_created",
  "waiting_for_provider_callback",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
]);

export const generationResultAssetKind = pgEnum(
  "generation_result_asset_kind",
  ["video"],
);

export const generationThread = pgTable(
  "generation_thread",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_thread_user_id_idx").on(table.userId),
    index("generation_thread_user_id_updated_at_idx").on(
      table.userId,
      table.updatedAt,
    ),
    index("generation_thread_user_id_project_id_updated_at_idx").on(
      table.userId,
      table.projectId,
      table.updatedAt,
    ),
    uniqueIndex("generation_thread_id_user_id_idx").on(table.id, table.userId),
    foreignKey({
      columns: [table.projectId, table.userId],
      foreignColumns: [project.id, project.userId],
      name: "generation_thread_project_user_fk",
    }),
  ],
);

export const generationSubmission = pgTable(
  "generation_submission",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    modelId: text("model_id")
      .notNull()
      .references(() => generationModel.id, { onDelete: "restrict" }),
    modelSpecId: text("model_spec_id")
      .notNull()
      .references(() => generationModelSpec.id, { onDelete: "restrict" }),
    submittedInput: jsonb("submitted_input")
      .$type<GenerationSubmissionInput>()
      .notNull(),
    requestedGenerations: integer("requested_generations").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_submission_thread_id_idx").on(table.threadId),
    index("generation_submission_user_id_idx").on(table.userId),
    index("generation_submission_model_id_idx").on(table.modelId),
    index("generation_submission_model_spec_id_idx").on(table.modelSpecId),
    foreignKey({
      columns: [table.threadId, table.userId],
      foreignColumns: [generationThread.id, generationThread.userId],
      name: "generation_submission_thread_user_fk",
    }).onDelete("cascade"),
  ],
);

export const generationJob = pgTable(
  "generation_job",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => generationSubmission.id, { onDelete: "cascade" }),
    submissionIndex: integer("submission_index").notNull(),
    status: generationJobStatus("status")
      .$type<GenerationJobStatus>()
      .default("queued")
      .notNull(),
    temporalWorkflowId: text("temporal_workflow_id"),
    temporalRunId: text("temporal_run_id"),
    callbackTokenHash: text("callback_token_hash"),
    providerId: text("provider_id").references(() => generationProvider.id, {
      onDelete: "restrict",
    }),
    providerTaskId: text("provider_task_id"),
    providerModelId: text("provider_model_id"),
    terminalError: jsonb("terminal_error").$type<GenerationJobTerminalError>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_job_submission_id_idx").on(table.submissionId),
    index("generation_job_status_idx").on(table.status),
    index("generation_job_temporal_workflow_id_idx").on(
      table.temporalWorkflowId,
    ),
    index("generation_job_provider_task_id_idx").on(table.providerTaskId),
    uniqueIndex("generation_job_submission_id_submission_index_idx").on(
      table.submissionId,
      table.submissionIndex,
    ),
  ],
);

export const generationResult = pgTable(
  "generation_result",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => generationJob.id, { onDelete: "cascade" }),
    providerId: text("provider_id")
      .notNull()
      .references(() => generationProvider.id, { onDelete: "restrict" }),
    providerTaskId: text("provider_task_id").notNull(),
    providerModelId: text("provider_model_id"),
    providerStatus: text("provider_status")
      .$type<SeedanceProviderStatus>()
      .notNull(),
    videoUrl: text("video_url"),
    usage: jsonb("usage").$type<SeedanceUsage>(),
    providerError: jsonb("provider_error").$type<SeedanceProviderError>(),
    rawPayload: jsonb("raw_payload").notNull(),
    receivedAt: timestamp("received_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("generation_result_job_id_idx").on(table.jobId),
    index("generation_result_provider_task_id_idx").on(table.providerTaskId),
    index("generation_result_provider_status_idx").on(table.providerStatus),
  ],
);

export const generationResultAsset = pgTable(
  "generation_result_asset",
  {
    id: text("id").primaryKey(),
    resultId: text("result_id")
      .notNull()
      .references(() => generationResult.id, { onDelete: "cascade" }),
    kind: generationResultAssetKind("kind")
      .$type<GenerationResultAssetKind>()
      .notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type"),
    contentLength: bigint("content_length", { mode: "number" }),
    etag: text("etag"),
    checksumSha256: text("checksum_sha256"),
    sourceProviderUrl: text("source_provider_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("generation_result_asset_result_id_kind_idx").on(
      table.resultId,
      table.kind,
    ),
    index("generation_result_asset_result_id_idx").on(table.resultId),
    index("generation_result_asset_bucket_object_key_idx").on(
      table.bucket,
      table.objectKey,
    ),
  ],
);

export const generationResultPreview = pgTable(
  "generation_result_preview",
  {
    id: text("id").primaryKey(),
    resultId: text("result_id")
      .notNull()
      .references(() => generationResult.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type"),
    contentLength: bigint("content_length", { mode: "number" }),
    etag: text("etag"),
    checksumSha256: text("checksum_sha256"),
    frameTimeMs: integer("frame_time_ms").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("generation_result_preview_result_id_idx").on(table.resultId),
    index("generation_result_preview_bucket_object_key_idx").on(
      table.bucket,
      table.objectKey,
    ),
  ],
);
