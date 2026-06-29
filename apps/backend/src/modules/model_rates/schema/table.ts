import { sql } from "drizzle-orm";
import {
  bigint,
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
import { generationModel } from "../../model/schema/table.ts";
import {
  generationJobFinalCostBases,
  generationModelRateComponents,
  generationModelRateQuantityUnits,
  type GenerationJobEstimatedCostSnapshot,
  type GenerationJobFinalCostBasis,
  type GenerationJobProviderCostSnapshot,
  type GenerationModelRateComponent,
  type GenerationModelRateConditions,
  type GenerationModelRateFinalQuantitySource,
  type GenerationModelRateQuantitySource,
  type GenerationModelRateQuantityUnit,
} from "../model_rates.types.ts";

export const generationModelRateComponent = pgEnum(
  "generation_model_rate_component",
  generationModelRateComponents,
);

export const generationModelRateQuantityUnit = pgEnum(
  "generation_model_rate_quantity_unit",
  generationModelRateQuantityUnits,
);

export const generationJobFinalCostBasis = pgEnum(
  "generation_job_final_cost_basis",
  generationJobFinalCostBases,
);

// NB: We should never, ever, go into the db and change this value. If we need to change it, we should create a new policy
// and build new application logic to get the latest policy.
export const generationPricingPolicy = pgTable(
  "generation_pricing_policy",
  {
    id: text("id").primaryKey(),
    surchargeBasisPoints: integer("surcharge_basis_points").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "generation_pricing_policy_surcharge_basis_points_nonnegative",
      sql`${table.surchargeBasisPoints} >= 0`,
    ),
  ],
);

export const generationModelRate = pgTable(
  "generation_model_rate",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => generationModel.id, { onDelete: "cascade" }),
    // Defines what are we charging for.
    component: generationModelRateComponent("component")
      .$type<GenerationModelRateComponent>()
      .notNull(),
    // Defines where we get the number to multiply by the rate. Normally the component
    // will tell us where to get the number from but if a model has a component of output_video it could use
    // output_duration_seconds OR something like provider_completion_tokens, so we make the distinction here.
    quantitySource: text("quantity_source")
      .$type<GenerationModelRateQuantitySource>()
      .notNull(),
    finalQuantitySource: text(
      "final_quantity_source",
    ).$type<GenerationModelRateFinalQuantitySource>(),
    quantityUnit: generationModelRateQuantityUnit("quantity_unit")
      .$type<GenerationModelRateQuantityUnit>()
      .notNull(),
    unitQuantity: integer("unit_quantity").notNull(),
    unitPriceUsdMicros: bigint("unit_price_usd_micros", {
      mode: "number",
    }).notNull(),
    conditions: jsonb("conditions")
      .$type<GenerationModelRateConditions>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_model_rate_model_id_idx").on(table.modelId),
    index("generation_model_rate_model_id_component_idx").on(
      table.modelId,
      table.component,
    ),
    check(
      "generation_model_rate_unit_quantity_positive",
      sql`${table.unitQuantity} > 0`,
    ),
    check(
      "generation_model_rate_unit_price_usd_micros_nonnegative",
      sql`${table.unitPriceUsdMicros} >= 0`,
    ),
    check(
      "generation_model_rate_conditions_object",
      sql`jsonb_typeof(${table.conditions}) = 'object'`,
    ),
  ],
);

export const generationJobCost = pgTable(
  "generation_job_cost",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => generationJob.id, { onDelete: "cascade" }),
    estimatedCostUsdMicros: bigint("estimated_cost_usd_micros", {
      mode: "number",
    }).notNull(),
    currencyCode: text("currency_code").default("USD").notNull(),
    estimatedCostSnapshot: jsonb("estimated_cost_snapshot")
      .$type<GenerationJobEstimatedCostSnapshot>()
      .notNull(),
    finalCostUsdMicros: bigint("final_cost_usd_micros", {
      mode: "number",
    }),
    finalCostBasis:
      generationJobFinalCostBasis(
        "final_cost_basis",
      ).$type<GenerationJobFinalCostBasis>(),
    finalizedAt: timestamp("finalized_at"),
    providerCostUsdMicros: bigint("provider_cost_usd_micros", {
      mode: "number",
    }),
    providerCostSnapshot: jsonb(
      "provider_cost_snapshot",
    ).$type<GenerationJobProviderCostSnapshot>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("generation_job_cost_job_id_idx").on(table.jobId),
    check(
      "generation_job_cost_estimated_cost_nonnegative",
      sql`${table.estimatedCostUsdMicros} >= 0`,
    ),
    check(
      "generation_job_cost_final_cost_nonnegative",
      sql`${table.finalCostUsdMicros} IS NULL OR ${table.finalCostUsdMicros} >= 0`,
    ),
    check(
      "generation_job_cost_provider_cost_nonnegative",
      sql`${table.providerCostUsdMicros} IS NULL OR ${table.providerCostUsdMicros} >= 0`,
    ),
    check(
      "generation_job_cost_currency_usd",
      sql`${table.currencyCode} = 'USD'`,
    ),
    check(
      "generation_job_cost_estimated_cost_snapshot_object",
      sql`jsonb_typeof(${table.estimatedCostSnapshot}) = 'object'`,
    ),
    check(
      "generation_job_cost_provider_cost_snapshot_object",
      sql`${table.providerCostSnapshot} IS NULL OR jsonb_typeof(${table.providerCostSnapshot}) = 'object'`,
    ),
    check(
      "generation_job_cost_final_fields_all_or_none",
      sql`(
        ${table.finalCostUsdMicros} IS NULL
        AND ${table.finalCostBasis} IS NULL
        AND ${table.finalizedAt} IS NULL
      ) OR (
        ${table.finalCostUsdMicros} IS NOT NULL
        AND ${table.finalCostBasis} IS NOT NULL
        AND ${table.finalizedAt} IS NOT NULL
      )`,
    ),
    check(
      "generation_job_cost_provider_cost_fields_all_or_none",
      sql`(
        ${table.providerCostUsdMicros} IS NULL
        AND ${table.providerCostSnapshot} IS NULL
      ) OR (
        ${table.providerCostUsdMicros} IS NOT NULL
        AND ${table.providerCostSnapshot} IS NOT NULL
      )`,
    ),
  ],
);
