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

import { generationJob } from "../../generation/schema/table.ts";
import {
  generationModelSpec,
  generationProvider,
} from "../../model/schema/table.ts";
import {
  generationRateLimitBucketKinds,
  generationRateLimitWindowAlignments,
  type GenerationModelRateLimitConditions,
  type GenerationRateLimitBucketKind,
  type GenerationRateLimitWindowAlignment,
} from "../model_rate_limits.types.ts";

export const generationRateLimitBucketKind = pgEnum(
  "generation_rate_limit_bucket_kind",
  generationRateLimitBucketKinds,
);

export const generationRateLimitWindowAlignment = pgEnum(
  "generation_rate_limit_window_alignment",
  generationRateLimitWindowAlignments,
);

export const generationRateLimitBucket = pgTable(
  "generation_rate_limit_bucket",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => generationProvider.id, { onDelete: "restrict" }),
    kind: generationRateLimitBucketKind("kind")
      .$type<GenerationRateLimitBucketKind>()
      .notNull(),
    maxValue: integer("max_value").notNull(),
    windowSeconds: integer("window_seconds"),
    windowAlignment: generationRateLimitWindowAlignment(
      "window_alignment",
    ).$type<GenerationRateLimitWindowAlignment>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "generation_rate_limit_bucket_max_value_positive",
      sql`${table.maxValue} > 0`,
    ),
    check(
      "generation_rate_limit_bucket_window_shape",
      sql`(
        ${table.kind} = 'request_window'
        AND ${table.windowSeconds} > 0
        AND ${table.windowAlignment} IS NOT NULL
      ) OR (
        ${table.kind} = 'concurrent_task'
        AND ${table.windowSeconds} IS NULL
        AND ${table.windowAlignment} IS NULL
      )`,
    ),
  ],
);

export const generationModelRateLimit = pgTable(
  "generation_model_rate_limit",
  {
    id: text("id").primaryKey(),
    modelSpecId: text("model_spec_id")
      .notNull()
      .references(() => generationModelSpec.id, { onDelete: "restrict" }),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => generationRateLimitBucket.id, {
        onDelete: "restrict",
      }),
    conditions: jsonb("conditions")
      .$type<GenerationModelRateLimitConditions>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("generation_model_rate_limit_spec_id_bucket_id_idx").on(
      table.modelSpecId,
      table.bucketId,
    ),
    index("generation_model_rate_limit_model_spec_id_idx").on(
      table.modelSpecId,
    ),
    index("generation_model_rate_limit_bucket_id_idx").on(table.bucketId),
    check(
      "generation_model_rate_limit_conditions_object",
      sql`jsonb_typeof(${table.conditions}) = 'object'`,
    ),
  ],
);

export const generationRateLimitWindowEntry = pgTable(
  "generation_rate_limit_window_entry",
  {
    id: text("id").primaryKey(),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => generationRateLimitBucket.id, {
        onDelete: "restrict",
      }),
    jobId: text("job_id")
      .notNull()
      .references(() => generationJob.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("generation_rate_limit_window_entry_bucket_occurred_at_idx").on(
      table.bucketId,
      table.occurredAt,
    ),
  ],
);

export const generationRateLimitConcurrencyLease = pgTable(
  "generation_rate_limit_concurrency_lease",
  {
    id: text("id").primaryKey(),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => generationRateLimitBucket.id, {
        onDelete: "restrict",
      }),
    jobId: text("job_id")
      .notNull()
      .references(() => generationJob.id, { onDelete: "cascade" }),
    acquiredAt: timestamp("acquired_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    releasedAt: timestamp("released_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_rate_limit_concurrency_lease_bucket_active_idx").on(
      table.bucketId,
      table.releasedAt,
      table.expiresAt,
    ),
    index("generation_rate_limit_concurrency_lease_job_id_idx").on(
      table.jobId,
    ),
    check(
      "generation_rate_limit_concurrency_lease_expires_after_acquired",
      sql`${table.expiresAt} > ${table.acquiredAt}`,
    ),
    check(
      "generation_rate_limit_concurrency_lease_released_after_acquired",
      sql`${table.releasedAt} IS NULL OR ${table.releasedAt} >= ${table.acquiredAt}`,
    ),
  ],
);
