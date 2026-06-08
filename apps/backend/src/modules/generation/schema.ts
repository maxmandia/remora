import { relations } from 'drizzle-orm'
import { index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { user } from '../auth/schema.ts'
import { generationModel, generationModelSpec, generationProvider } from '../model/schema.ts'

import type {
  GenerationJobTerminalError,
  GenerationJobStatus,
  GenerationJobSubmittedInput,
} from './generation.types.ts'

export const generationJobStatus = pgEnum('generation_job_status', [
  'queued',
  'creating_provider_task',
  'provider_task_created',
  'failed',
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
}))
