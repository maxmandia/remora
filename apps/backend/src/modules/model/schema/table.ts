import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  GenerationModelAdapter,
  GenerationModelRateLimitMode,
  GenerationModelSpec,
} from "../model.types.ts";

export const generationPublicationStatus = pgEnum(
  "generation_publication_status",
  ["draft", "published", "archived"],
);

export const generationModelType = pgEnum("generation_model_type", ["video"]);

export const generationModelAdapter = pgEnum("generation_model_adapter", [
  "byteplus_seedance_video",
]);

export const generationModelRateLimitMode = pgEnum(
  "generation_model_rate_limit_mode",
  ["unconfigured", "enforced", "unlimited"],
);

export const generationProvider = pgTable("generation_provider", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const generationModel = pgTable(
  "generation_model",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => generationProvider.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    type: generationModelType("type").notNull(),
    status: generationPublicationStatus("status").default("draft").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_model_provider_id_idx").on(table.providerId),
    index("generation_model_status_idx").on(table.status),
  ],
);

export const generationModelSpec = pgTable(
  "generation_model_spec",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => generationModel.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    status: generationPublicationStatus("status").default("draft").notNull(),
    // NB: We use the `adapter` field in our application code to ensure we have business logic to deal with new models.
    // Prevents us from adding a model to the DB without declaring business constraints.
    adapter: generationModelAdapter("adapter").$type<GenerationModelAdapter>(),
    rateLimitMode: generationModelRateLimitMode("rate_limit_mode")
      .$type<GenerationModelRateLimitMode>()
      .default("unconfigured")
      .notNull(),
    spec: jsonb("spec").$type<GenerationModelSpec>().notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("generation_model_spec_model_id_version_idx").on(
      table.modelId,
      table.version,
    ),
    uniqueIndex("generation_model_spec_id_model_id_idx").on(
      table.id,
      table.modelId,
    ),
    index("generation_model_spec_model_id_idx").on(table.modelId),
    index("generation_model_spec_status_idx").on(table.status),
    check("generation_model_spec_version_positive", sql`${table.version} > 0`),
    check(
      "generation_model_spec_schema_version_positive",
      sql`${table.schemaVersion} > 0`,
    ),
    check(
      "generation_model_spec_spec_object",
      sql`jsonb_typeof(${table.spec}) = 'object'`,
    ),
    check(
      "generation_model_spec_publication_shape",
      sql`(
        ${table.status} = 'draft'
        AND ${table.publishedAt} IS NULL
      ) OR (
        ${table.status} IN ('published', 'archived')
        AND ${table.publishedAt} IS NOT NULL
      )`,
    ),
    check(
      "generation_model_spec_published_configuration",
      sql`${table.status} <> 'published' OR (
        ${table.adapter} IS NOT NULL
        AND ${table.rateLimitMode} <> 'unconfigured'
      )`,
    ),
  ],
);
