import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import type { ModelCatalogSpec } from './types.ts'

export const generationPublicationStatus = pgEnum('generation_publication_status', [
  'draft',
  'published',
  'archived',
])

export const generationModelType = pgEnum('generation_model_type', ['video'])

export const generationProvider = pgTable('generation_provider', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const generationModel = pgTable(
  'generation_model',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => generationProvider.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    type: generationModelType('type').notNull(),
    status: generationPublicationStatus('status').default('draft').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('generation_model_provider_id_idx').on(table.providerId),
    index('generation_model_status_idx').on(table.status),
  ],
)

export const generationModelSpec = pgTable(
  'generation_model_spec',
  {
    id: text('id').primaryKey(),
    modelId: text('model_id')
      .notNull()
      .references(() => generationModel.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    status: generationPublicationStatus('status').default('draft').notNull(),
    spec: jsonb('spec').$type<ModelCatalogSpec>().notNull(),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('generation_model_spec_model_id_version_idx').on(
      table.modelId,
      table.version,
    ),
    index('generation_model_spec_model_id_idx').on(table.modelId),
    index('generation_model_spec_status_idx').on(table.status),
  ],
)

export const generationProviderRelations = relations(generationProvider, ({ many }) => ({
  models: many(generationModel),
}))

export const generationModelRelations = relations(generationModel, ({ one, many }) => ({
  provider: one(generationProvider, {
    fields: [generationModel.providerId],
    references: [generationProvider.id],
  }),
  specs: many(generationModelSpec),
}))

export const generationModelSpecRelations = relations(generationModelSpec, ({ one }) => ({
  model: one(generationModel, {
    fields: [generationModelSpec.modelId],
    references: [generationModel.id],
  }),
}))
