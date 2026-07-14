import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { ModelCatalogState, ModelDefinitionV1 } from "./model.types.ts";
import {
  buildModelDefinitionPlan,
  normalizeModelDefinition,
  parseGenerationModelRateConditions,
  parseGenerationModelRateLimitConditions,
  renderModelDefinitionMigration,
  validateModelDefinition,
} from "./model.utils.ts";

const definitionPath = new URL(
  "../../../catalog/models/seedance-2.0-video.json",
  import.meta.url,
);

describe("model definitions", () => {
  it("strictly parses persisted pricing and rate-limit conditions", () => {
    expect(() =>
      parseGenerationModelRateConditions({ unsupported: true }),
    ).toThrow('Unrecognized key: "unsupported"');
    expect(() =>
      parseGenerationModelRateLimitConditions({ unsupported: true }),
    ).toThrow('Unrecognized key: "unsupported"');
  });

  it("rejects unknown definition keys", () => {
    const definition = readDefinition();
    (definition.model as unknown as Record<string, unknown>).unexpected = true;

    expect(() => validateModelDefinition(definition)).toThrow(
      'model: Unrecognized key: "unexpected"',
    );
  });

  it("requires published specs to configure or explicitly disable limits", () => {
    const definition = readDefinition();
    definition.specs[0].rateLimits = { mode: "unconfigured" };

    expect(() => validateModelDefinition(definition)).toThrow(
      "must configure or explicitly disable rate limits",
    );
  });

  it("rejects incompatible adapter and provider combinations", () => {
    const definition = readDefinition();
    definition.model.providerId = "kling";

    expect(() => validateModelDefinition(definition)).toThrow(
      "is not compatible with kling/video",
    );
  });

  it("applies BytePlus Seedance adapter requirements", () => {
    const definition = readDefinition();
    definition.specs[0].configuration.providerModelId = null;

    expect(() => validateModelDefinition(definition)).toThrow(
      "requires providerModelId",
    );
  });

  it("rejects pricing gaps across reachable generation facts", () => {
    const definition = readDefinition();
    definition.specs[0].rates = definition.specs[0].rates.filter(
      (rate) => rate.conditions.inputIncludesVideo !== true,
    );

    expect(() => validateModelDefinition(definition)).toThrow(
      "has no pricing for",
    );
  });

  it("rejects overlapping rates for the same billable component", () => {
    const definition = readDefinition();
    const duplicate = structuredClone(definition.specs[0].rates[0]);
    duplicate.id = `${duplicate.id}-duplicate`;
    definition.specs[0].rates.push(duplicate);

    expect(() => validateModelDefinition(definition)).toThrow(
      "matching provider_video_tokens rates",
    );
  });

  it("requires enforced limits to cover every reachable resolution", () => {
    const definition = readDefinition();
    const rateLimits = definition.specs[0].rateLimits;

    if (rateLimits.mode !== "enforced") {
      throw new Error("Seedance fixture must use enforced rate limits");
    }

    rateLimits.rules = rateLimits.rules.filter(
      (rule) => rule.conditions.outputResolution !== "4k",
    );

    expect(() => validateModelDefinition(definition)).toThrow(
      "has no rate-limit rule for 4k",
    );
  });

  it("plans mutable price updates and renders deterministic SQL", () => {
    const definition = readDefinition();
    const current = createCatalogState(definition);
    definition.specs[0].rates[0].unitPriceUsdMicros += 1;

    const plan = buildModelDefinitionPlan({ definition, current });

    expect(plan.changes).toEqual([
      {
        action: "update",
        entity: "rate",
        id: definition.specs[0].rates[0].id,
        fields: ["unitPriceUsdMicros"],
      },
    ]);
    expect(renderModelDefinitionMigration(plan, { allowRemovals: false })).toBe(
      renderModelDefinitionMigration(plan, { allowRemovals: false }),
    );
  });

  it("requires explicit approval before generating destructive removals", () => {
    const definition = readDefinition();
    const current = createCatalogState(definition);
    const staleRate = structuredClone(current.specs[0].rates[0]);
    staleRate.id = `${staleRate.id}-stale`;
    current.specs[0].rates.push(staleRate);
    const plan = buildModelDefinitionPlan({ definition, current });

    expect(plan.hasRemovals).toBe(true);
    expect(() =>
      renderModelDefinitionMigration(plan, { allowRemovals: false }),
    ).toThrow("--allow-removals");
    expect(
      renderModelDefinitionMigration(plan, { allowRemovals: true }),
    ).toContain('DELETE FROM "generation_model_rate"');
  });

  it("rejects released spec configuration changes", () => {
    const definition = readDefinition();
    const current = createCatalogState(definition);
    definition.specs[0].configuration.providerModelId =
      "changed-provider-model";

    expect(buildModelDefinitionPlan({ definition, current }).issues).toContain(
      "Released spec seedance-2.0-video-v1 configuration is immutable",
    );
  });

  it("rejects immutable model and rate identity changes", () => {
    const definition = readDefinition();
    const current = createCatalogState(definition);
    current.model!.providerId = "kling";
    definition.specs[0].rates[0].component = "output_video";
    definition.specs[0].rates[0].quantitySource = "output_duration_seconds";
    definition.specs[0].rates[0].finalQuantitySource = null;
    definition.specs[0].rates[0].quantityUnit = "second";

    expect(buildModelDefinitionPlan({ definition, current }).issues).toContain(
      "Model seedance-2.0-video cannot change provider",
    );

    current.model!.providerId = "byteplus";
    expect(buildModelDefinitionPlan({ definition, current }).issues).toContain(
      `Rate ${definition.specs[0].rates[0].id} cannot change component; create a new rate id`,
    );
  });

  it("allows status-only archival and rejects returning a release to draft", () => {
    const archived = readDefinition();
    const current = createCatalogState(archived);
    archived.specs[0].status = "archived";

    expect(
      buildModelDefinitionPlan({ definition: archived, current }).changes,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "archive",
          entity: "model",
        }),
        expect.objectContaining({
          action: "archive",
          entity: "spec",
        }),
      ]),
    );

    const draft = readDefinition();
    draft.specs[0].status = "draft";

    expect(
      buildModelDefinitionPlan({ definition: draft, current }).issues,
    ).toContain("Released spec seedance-2.0-video-v1 cannot return to draft");
  });
});

function readDefinition(): ModelDefinitionV1 {
  return validateModelDefinition(
    JSON.parse(readFileSync(definitionPath, "utf8")),
  );
}

function createCatalogState(definition: ModelDefinitionV1): ModelCatalogState {
  const normalized = normalizeModelDefinition(definition);

  return {
    providerExists: true,
    model: {
      id: normalized.model.id,
      providerId: normalized.model.providerId,
      displayName: normalized.model.displayName,
      type: normalized.model.type,
      status: normalized.model.status,
    },
    specs: normalized.specs.map((spec) => ({
      id: spec.id,
      modelId: normalized.model.id,
      version: spec.version,
      schemaVersion: spec.schemaVersion,
      status: spec.status,
      adapter: spec.adapter,
      rateLimitMode: spec.rateLimits.mode,
      spec: spec.spec,
      publishedAt: new Date("2026-07-01T00:00:00.000Z"),
      rates: structuredClone(spec.rates),
      rateLimits:
        spec.rateLimits.mode === "enforced"
          ? structuredClone(spec.rateLimits.rules)
          : [],
    })),
  };
}
