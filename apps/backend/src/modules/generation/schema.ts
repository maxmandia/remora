import { relations } from "drizzle-orm";
import {
  bigint,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../auth/schema.ts";
import {
  generationModel,
  generationModelSpec,
  generationProvider,
} from "../model/schema.ts";

import type {
  GenerationJobTerminalError,
  GenerationJobStatus,
  GenerationJobSubmittedInput,
  GenerationResultAssetKind,
  SeedanceProviderError,
  SeedanceProviderStatus,
  SeedanceUsage,
} from "./generation.types.ts";

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
  ["video", "last_frame"],
);

export const generationThread = pgTable(
  "generation_thread",
  {
    id: text("id").primaryKey(),
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
    uniqueIndex("generation_thread_id_user_id_idx").on(table.id, table.userId),
  ],
);

export const generationJob = pgTable(
  "generation_job",
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
    status: generationJobStatus("status")
      .$type<GenerationJobStatus>()
      .default("queued")
      .notNull(),
    submittedInput: jsonb("submitted_input")
      .$type<GenerationJobSubmittedInput>()
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
    index("generation_job_thread_id_idx").on(table.threadId),
    index("generation_job_user_id_idx").on(table.userId),
    index("generation_job_model_id_idx").on(table.modelId),
    index("generation_job_model_spec_id_idx").on(table.modelSpecId),
    index("generation_job_status_idx").on(table.status),
    index("generation_job_temporal_workflow_id_idx").on(
      table.temporalWorkflowId,
    ),
    index("generation_job_provider_task_id_idx").on(table.providerTaskId),
    foreignKey({
      columns: [table.threadId, table.userId],
      foreignColumns: [generationThread.id, generationThread.userId],
      name: "generation_job_thread_user_fk",
    }).onDelete("cascade"),
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
    lastFrameUrl: text("last_frame_url"),
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

export const generationThreadRelations = relations(
  generationThread,
  ({ many, one }) => ({
    user: one(user, {
      fields: [generationThread.userId],
      references: [user.id],
    }),
    jobs: many(generationJob),
  }),
);

export const generationJobRelations = relations(generationJob, ({ one }) => ({
  thread: one(generationThread, {
    fields: [generationJob.threadId, generationJob.userId],
    references: [generationThread.id, generationThread.userId],
  }),
  user: one(user, {
    fields: [generationJob.userId],
    references: [user.id],
  }),
  model: one(generationModel, {
    fields: [generationJob.modelId],
    references: [generationModel.id],
  }),
  modelSpec: one(generationModelSpec, {
    fields: [generationJob.modelSpecId],
    references: [generationModelSpec.id],
  }),
  provider: one(generationProvider, {
    fields: [generationJob.providerId],
    references: [generationProvider.id],
  }),
  result: one(generationResult, {
    fields: [generationJob.id],
    references: [generationResult.jobId],
  }),
}));

export const generationResultRelations = relations(
  generationResult,
  ({ many, one }) => ({
    job: one(generationJob, {
      fields: [generationResult.jobId],
      references: [generationJob.id],
    }),
    provider: one(generationProvider, {
      fields: [generationResult.providerId],
      references: [generationProvider.id],
    }),
    assets: many(generationResultAsset),
  }),
);

export const generationResultAssetRelations = relations(
  generationResultAsset,
  ({ one }) => ({
    result: one(generationResult, {
      fields: [generationResultAsset.resultId],
      references: [generationResult.id],
    }),
  }),
);
