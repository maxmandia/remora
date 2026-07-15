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

describe("Kling 3.0 text-to-video adapter", () => {
  it("accepts the exact Kling 3.0 Pro payload contract", () => {
    expect(validateModelDefinition(createKlingDefinition())).toEqual(
      createKlingDefinition(),
    );
  });

  it.each<
    [
      name: string,
      mutate: (definition: ModelDefinitionV1) => void,
      expectedIssue: string,
    ]
  >([
    [
      "provider",
      (definition) => {
        definition.model.providerId = "byteplus";
      },
      "is not compatible with byteplus/video",
    ],
    [
      "provider model",
      (definition) => {
        definition.specs[0].configuration.providerModelId = "kling-v3-turbo";
      },
      "requires providerModelId kling-v3",
    ],
    [
      "endpoint",
      (definition) => {
        definition.specs[0].configuration.endpoint.path =
          "/v1/videos/image2video";
      },
      "requires POST /v1/videos/text2video endpoint",
    ],
    [
      "model parameter",
      (definition) => {
        definition.specs[0].configuration.modelParameter.path = ["model"];
      },
      "requires spec-sourced model parameter at model_name",
    ],
    [
      "transform",
      (definition) => {
        definition.specs[0].configuration.transforms.push({
          kind: "seedanceContentArray",
        });
      },
      "does not support transforms",
    ],
  ])("rejects an incompatible %s", (_name, mutate, expectedIssue) => {
    const definition = createKlingDefinition();
    mutate(definition);

    expect(() => validateModelDefinition(definition)).toThrow(expectedIssue);
  });

  it("rejects extra attachment fields", () => {
    const definition = createKlingDefinition();
    definition.specs[0].configuration.fields.push({
      id: "images",
      label: "Images",
      componentKind: "mediaList",
      valueKind: "array",
      required: false,
      advanced: false,
      defaultValue: [],
      omitWhenEmpty: true,
      omitWhenDefault: false,
      mediaRoleCapabilities: ["reference"],
      mediaConstraints: {
        mimeTypes: ["image/png"],
        extensions: [".png"],
      },
      notes: [],
    });
    definition.specs[0].configuration.groups[0].fieldIds.push("images");

    expect(() => validateModelDefinition(definition)).toThrow(
      "requires exactly fields prompt, resolution, aspectRatio, duration, generateAudio, callbackUrl",
    );
  });

  it("rejects missing canonical fields", () => {
    const definition = createKlingDefinition();
    definition.specs[0].configuration.fields.pop();
    definition.specs[0].configuration.groups[0].fieldIds.pop();

    expect(() => validateModelDefinition(definition)).toThrow(
      "requires exactly fields prompt, resolution, aspectRatio, duration, generateAudio, callbackUrl",
    );
  });

  it.each<
    [
      name: string,
      mutate: (definition: ModelDefinitionV1) => void,
      expectedIssue: string,
    ]
  >([
    [
      "prompt requirement",
      (definition) => {
        getKlingField(definition, "prompt").required = false;
      },
      "field prompt must be required with maxLength 2500",
    ],
    [
      "resolution mapping",
      (definition) => {
        getKlingField(definition, "resolution").providerValueMap![0] = {
          canonicalValue: "1080p",
          providerValue: "std",
        };
      },
      "field resolution must be hidden, fix 1080p, and map it to pro",
    ],
    [
      "resolution visibility",
      (definition) => {
        getKlingField(definition, "resolution").componentKind = "select";
      },
      "field resolution must be hidden, fix 1080p, and map it to pro",
    ],
    [
      "aspect-ratio options",
      (definition) => {
        getKlingField(definition, "aspectRatio").options!.push({
          label: "4:3",
          value: "4:3",
        });
      },
      "field aspectRatio must default to 16:9 and support exactly 16:9, 9:16, and 1:1",
    ],
    [
      "aspect-ratio default",
      (definition) => {
        getKlingField(definition, "aspectRatio").defaultValue = "1:1";
      },
      "field aspectRatio must default to 16:9 and support exactly 16:9, 9:16, and 1:1",
    ],
    [
      "duration mapping",
      (definition) => {
        getKlingField(definition, "duration").providerValueMap!.pop();
      },
      "field duration must default to 5 and support integers 3 through 15 mapped to strings",
    ],
    [
      "duration default",
      (definition) => {
        getKlingField(definition, "duration").defaultValue = 10;
      },
      "field duration must default to 5 and support integers 3 through 15 mapped to strings",
    ],
    [
      "audio mapping",
      (definition) => {
        getKlingField(definition, "generateAudio").providerValueMap![0] = {
          canonicalValue: false,
          providerValue: "disabled",
        };
      },
      "field generateAudio must default to false and map false to off and true to on",
    ],
    [
      "audio default",
      (definition) => {
        getKlingField(definition, "generateAudio").defaultValue = true;
      },
      "field generateAudio must default to false and map false to off and true to on",
    ],
    [
      "callback path",
      (definition) => {
        getKlingField(definition, "callbackUrl").providerPath = ["callback"];
      },
      "field callbackUrl must use string at callback_url",
    ],
    [
      "default omission",
      (definition) => {
        getKlingField(definition, "resolution").omitWhenDefault = true;
      },
      "field resolution must set omitWhenDefault to false",
    ],
  ])("rejects an invalid %s", (_name, mutate, expectedIssue) => {
    const definition = createKlingDefinition();
    mutate(definition);

    expect(() => validateModelDefinition(definition)).toThrow(expectedIssue);
  });
});

function readDefinition(): ModelDefinitionV1 {
  return validateModelDefinition(
    JSON.parse(readFileSync(definitionPath, "utf8")),
  );
}

function createKlingDefinition(): ModelDefinitionV1 {
  const durations = Array.from({ length: 13 }, (_, index) => index + 3);

  return {
    schemaVersion: 1,
    model: {
      id: "kling-v3-1080p-pro",
      providerId: "kling",
      displayName: "Kling 3.0 1080p (Pro)",
      type: "video",
    },
    specs: [
      {
        id: "kling-v3-1080p-pro-v1",
        version: 1,
        schemaVersion: 1,
        status: "draft",
        adapter: "kling_v3_text_to_video",
        configuration: {
          providerModelId: "kling-v3",
          description: "Kling 3.0 1080p text-to-video generation.",
          sourceUrls: [
            "https://kling.ai/document-api/api/video/3-0-omni/text-to-video",
          ],
          endpoint: {
            method: "POST",
            path: "/v1/videos/text2video",
          },
          modelParameter: {
            path: ["model_name"],
            source: "spec",
          },
          fields: [
            {
              id: "prompt",
              label: "Prompt",
              componentKind: "promptTextarea",
              valueKind: "string",
              required: true,
              advanced: false,
              defaultValue: "",
              providerPath: ["prompt"],
              omitWhenEmpty: true,
              omitWhenDefault: false,
              maxLength: 2500,
              notes: [],
            },
            {
              id: "resolution",
              label: "Resolution",
              componentKind: "hidden",
              valueKind: "string",
              required: false,
              advanced: false,
              defaultValue: "1080p",
              providerPath: ["mode"],
              providerValueMap: [
                { canonicalValue: "1080p", providerValue: "pro" },
              ],
              omitWhenEmpty: true,
              omitWhenDefault: false,
              options: [{ label: "1080p", value: "1080p" }],
              notes: [],
            },
            {
              id: "aspectRatio",
              label: "Aspect ratio",
              componentKind: "select",
              valueKind: "string",
              required: false,
              advanced: false,
              defaultValue: "16:9",
              providerPath: ["aspect_ratio"],
              omitWhenEmpty: true,
              omitWhenDefault: false,
              options: [
                { label: "16:9", value: "16:9" },
                { label: "9:16", value: "9:16" },
                { label: "1:1", value: "1:1" },
              ],
              notes: [],
            },
            {
              id: "duration",
              label: "Duration",
              componentKind: "select",
              valueKind: "integer",
              required: false,
              advanced: false,
              defaultValue: 5,
              providerPath: ["duration"],
              providerValueMap: durations.map((value) => ({
                canonicalValue: value,
                providerValue: String(value),
              })),
              omitWhenEmpty: true,
              omitWhenDefault: false,
              options: durations.map((value) => ({
                label: `${value}s`,
                value,
              })),
              min: 3,
              max: 15,
              notes: [],
            },
            {
              id: "generateAudio",
              label: "Generate audio",
              componentKind: "toggle",
              valueKind: "boolean",
              required: false,
              advanced: false,
              defaultValue: false,
              providerPath: ["sound"],
              providerValueMap: [
                { canonicalValue: false, providerValue: "off" },
                { canonicalValue: true, providerValue: "on" },
              ],
              omitWhenEmpty: true,
              omitWhenDefault: false,
              options: [
                { label: "Off", value: false },
                { label: "On", value: true },
              ],
              notes: [],
            },
            {
              id: "callbackUrl",
              label: "Callback URL",
              componentKind: "textInput",
              valueKind: "string",
              required: false,
              advanced: true,
              defaultValue: "",
              providerPath: ["callback_url"],
              omitWhenEmpty: true,
              omitWhenDefault: false,
              notes: [],
            },
          ],
          groups: [
            {
              id: "generation",
              label: "Generation",
              fieldIds: [
                "prompt",
                "resolution",
                "aspectRatio",
                "duration",
                "generateAudio",
                "callbackUrl",
              ],
              advanced: false,
            },
          ],
          transforms: [],
          validationRules: [],
        },
        rates: [],
        rateLimits: { mode: "unconfigured" },
      },
    ],
  };
}

function getKlingField(definition: ModelDefinitionV1, fieldId: string) {
  const field = definition.specs[0].configuration.fields.find(
    (candidate) => candidate.id === fieldId,
  );

  if (!field) {
    throw new Error(`Missing Kling test field: ${fieldId}`);
  }

  return field;
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
