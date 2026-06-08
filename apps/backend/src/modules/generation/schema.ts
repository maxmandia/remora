import { relations } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { user } from '../auth/schema.ts'
import { generationModel, generationModelSpec, generationProvider } from '../model/schema.ts'

import type {
  GenerationJobTerminalError,
  GenerationJobStatus,
  GenerationJobSubmittedInput,
  SeedanceProviderError,
  SeedanceProviderStatus,
  SeedanceUsage,
} from './generation.types.ts'

export const generationJobStatus = pgEnum('generation_job_status', [
  'queued',
  'creating_provider_task',
  'provider_task_created',
  'waiting_for_provider_callback',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
])

export const generationJob = pgTable(
  'generation_job',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    modelId: text('model_id')
      .notNull()
      .references(() => generationModel.id, { onDelete: 'restrict' }),
    modelSpecId: text('model_spec_id')
      .notNull()
      .references(() => generationModelSpec.id, { onDelete: 'restrict' }),
    status: generationJobStatus('status')
      .$type<GenerationJobStatus>()
      .default('queued')
      .notNull(),
    submittedInput: jsonb('submitted_input')
      .$type<GenerationJobSubmittedInput>()
      .notNull(),
    temporalWorkflowId: text('temporal_workflow_id'),
    temporalRunId: text('temporal_run_id'),
    callbackTokenHash: text('callback_token_hash'),
    providerId: text('provider_id').references(() => generationProvider.id, {
      onDelete: 'restrict',
    }),
    providerTaskId: text('provider_task_id'),
    providerModelId: text('provider_model_id'),
    terminalError: jsonb('terminal_error').$type<GenerationJobTerminalError>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('generation_job_user_id_idx').on(table.userId),
    index('generation_job_model_id_idx').on(table.modelId),
    index('generation_job_model_spec_id_idx').on(table.modelSpecId),
    index('generation_job_status_idx').on(table.status),
    index('generation_job_temporal_workflow_id_idx').on(table.temporalWorkflowId),
    index('generation_job_provider_task_id_idx').on(table.providerTaskId),
  ],
)

export const generationResult = pgTable(
  'generation_result',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => generationJob.id, { onDelete: 'cascade' }),
    providerId: text('provider_id')
      .notNull()
      .references(() => generationProvider.id, { onDelete: 'restrict' }),
    providerTaskId: text('provider_task_id').notNull(),
    providerModelId: text('provider_model_id'),
    providerStatus: text('provider_status').$type<SeedanceProviderStatus>().notNull(),
    videoUrl: text('video_url'),
    lastFrameUrl: text('last_frame_url'),
    usage: jsonb('usage').$type<SeedanceUsage>(),
    providerError: jsonb('provider_error').$type<SeedanceProviderError>(),
    rawPayload: jsonb('raw_payload').notNull(),
    receivedAt: timestamp('received_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('generation_result_job_id_idx').on(table.jobId),
    index('generation_result_provider_task_id_idx').on(table.providerTaskId),
    index('generation_result_provider_status_idx').on(table.providerStatus),
  ],
)

export const generationJobRelations = relations(generationJob, ({ one }) => ({
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
}))

export const generationResultRelations = relations(generationResult, ({ one }) => ({
  job: one(generationJob, {
    fields: [generationResult.jobId],
    references: [generationJob.id],
  }),
  provider: one(generationProvider, {
    fields: [generationResult.providerId],
    references: [generationProvider.id],
  }),
}))
