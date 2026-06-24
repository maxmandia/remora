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
} from "drizzle-orm/pg-core";

import { generationModel } from "../../model/schema/table.ts";
import {
  generationModelRateComponents,
  generationModelRateQuantityUnits,
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
