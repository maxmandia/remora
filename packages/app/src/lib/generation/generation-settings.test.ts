import type {
  GenerationFieldSpec,
  PublishedGenerationModelSummary,
} from "@remora/domain/generation-model/dto";
import { describe, expect, it } from "vitest";

import {
  getDefaultGenerationSettings,
  isGenerationSettingsValidForModel,
} from "./generation-settings.ts";

describe("generation settings helpers", () => {
  it("extracts defaults for composer settings from a published model", () => {
    expect(
      getDefaultGenerationSettings(
        createModel([
          createField({
            id: "aspectRatio",
            defaultValue: "16:9",
            valueKind: "string",
          }),
          createField({
            id: "resolution",
            defaultValue: "720p",
            valueKind: "string",
          }),
          createField({
            id: "duration",
            defaultValue: 5,
            valueKind: "integer",
          }),
          createField({
            id: "generateAudio",
            defaultValue: true,
            valueKind: "boolean",
          }),
        ]),
      ),
    ).toEqual({
      modelType: "video",
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
      requestedGenerations: 1,
    });
  });

  it("retains hidden canonical values in composer defaults", () => {
    expect(
      getDefaultGenerationSettings(
        createModel([
          createField({
            id: "aspectRatio",
            defaultValue: "16:9",
            valueKind: "string",
          }),
          createField({
            id: "resolution",
            componentKind: "hidden",
            defaultValue: "1080p",
            valueKind: "string",
          }),
          createField({
            id: "duration",
            defaultValue: 5,
            valueKind: "integer",
          }),
          createField({
            id: "generateAudio",
            defaultValue: false,
            valueKind: "boolean",
          }),
        ]),
      ),
    ).toEqual({
      modelType: "video",
      aspectRatio: "16:9",
      resolution: "1080p",
      duration: 5,
      generateAudio: false,
      requestedGenerations: 1,
    });
  });

  it("defaults draft-capable video models to full quality", () => {
    expect(
      getDefaultGenerationSettings(
        createModel([
          createField({
            id: "aspectRatio",
            defaultValue: "16:9",
            valueKind: "string",
          }),
          createField({
            id: "resolution",
            defaultValue: "1080p",
            valueKind: "string",
          }),
          createField({
            id: "duration",
            defaultValue: 5,
            valueKind: "integer",
          }),
          createField({
            id: "generateAudio",
            defaultValue: false,
            valueKind: "boolean",
          }),
          createField({
            id: "draft",
            defaultValue: false,
            valueKind: "boolean",
            options: [
              { label: "Full quality", value: false },
              { label: "Draft", value: true },
            ],
          }),
        ]),
      ),
    ).toEqual({
      modelType: "video",
      aspectRatio: "16:9",
      resolution: "1080p",
      duration: 5,
      generateAudio: false,
      draft: false,
      requestedGenerations: 1,
    });
  });

  it("falls back to the first typed option when a default is missing", () => {
    expect(
      getDefaultGenerationSettings(
        createModel([
          createField({
            id: "aspectRatio",
            valueKind: "string",
            options: [{ label: "9:16", value: "9:16" }],
          }),
          createField({
            id: "resolution",
            valueKind: "string",
            options: [{ label: "720p", value: "720p" }],
          }),
          createField({
            id: "duration",
            valueKind: "integer",
            options: [{ label: "10s", value: 10 }],
          }),
          createField({
            id: "generateAudio",
            valueKind: "boolean",
            options: [{ label: "Off", value: false }],
          }),
        ]),
      ),
    ).toEqual({
      modelType: "video",
      aspectRatio: "9:16",
      resolution: "720p",
      duration: 10,
      generateAudio: false,
      requestedGenerations: 1,
    });
  });

  it("returns null when required composer settings are absent", () => {
    expect(
      getDefaultGenerationSettings(
        createModel([
          createField({
            id: "aspectRatio",
            defaultValue: "16:9",
            valueKind: "string",
          }),
        ]),
      ),
    ).toBeNull();
  });

  it("extracts image defaults without requiring video-only fields", () => {
    expect(
      getDefaultGenerationSettings(
        createImageModel([
          createField({
            id: "aspectRatio",
            defaultValue: "1:1",
            valueKind: "string",
          }),
          createField({
            id: "resolution",
            defaultValue: "1K",
            valueKind: "string",
          }),
        ]),
      ),
    ).toEqual({
      modelType: "image",
      aspectRatio: "1:1",
      resolution: "1K",
      requestedGenerations: 1,
    });
  });

  it("validates settings against the current model options and shape", () => {
    const model = createModel([
      createField({
        id: "aspectRatio",
        valueKind: "string",
        options: [{ label: "16:9", value: "16:9" }],
      }),
      createField({
        id: "resolution",
        valueKind: "string",
        options: [{ label: "720p", value: "720p" }],
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        min: 4,
        max: 10,
        options: [{ label: "5s", value: 5 }],
      }),
      createField({
        id: "generateAudio",
        valueKind: "boolean",
        options: [{ label: "On", value: true }],
      }),
    ]);
    const settings = {
      modelType: "video",
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
      requestedGenerations: 2,
    };

    expect(isGenerationSettingsValidForModel(model, settings)).toBe(true);
    expect(
      isGenerationSettingsValidForModel(model, {
        ...settings,
        resolution: "1080p",
      }),
    ).toBe(false);
    expect(
      isGenerationSettingsValidForModel(model, {
        ...settings,
        unexpected: true,
      }),
    ).toBe(false);
    expect(
      isGenerationSettingsValidForModel(model, {
        ...settings,
        requestedGenerations: 16,
      }),
    ).toBe(false);
  });

  it("accepts legacy full-quality settings for draft-capable models", () => {
    const model = createModel([
      createField({
        id: "aspectRatio",
        valueKind: "string",
        options: [{ label: "16:9", value: "16:9" }],
      }),
      createField({
        id: "resolution",
        valueKind: "string",
        options: [{ label: "1080p", value: "1080p" }],
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        options: [{ label: "5s", value: 5 }],
      }),
      createField({
        id: "generateAudio",
        valueKind: "boolean",
        options: [{ label: "Off", value: false }],
      }),
      createField({
        id: "draft",
        valueKind: "boolean",
        options: [
          { label: "Full quality", value: false },
          { label: "Draft", value: true },
        ],
      }),
    ]);
    const legacySettings = {
      modelType: "video",
      aspectRatio: "16:9",
      resolution: "1080p",
      duration: 5,
      generateAudio: false,
      requestedGenerations: 1,
    };

    expect(isGenerationSettingsValidForModel(model, legacySettings)).toBe(true);
    expect(
      isGenerationSettingsValidForModel(model, {
        ...legacySettings,
        draft: true,
      }),
    ).toBe(true);
    expect(
      isGenerationSettingsValidForModel(model, {
        ...legacySettings,
        draft: "true",
      }),
    ).toBe(false);
  });
});

function createField(
  overrides: Partial<GenerationFieldSpec> = {},
): GenerationFieldSpec {
  return {
    id: "prompt",
    label: "Prompt",
    componentKind: "promptTextarea",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  } as GenerationFieldSpec;
}

function createModel(
  fields: [GenerationFieldSpec, ...GenerationFieldSpec[]],
): PublishedGenerationModelSummary {
  const fieldIds = fields.map((field) => field.id) as [
    GenerationFieldSpec["id"],
    ...GenerationFieldSpec["id"][],
  ];

  return {
    id: "test-model",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Test Model",
    type: "video",
    latestSpecId: "test-model-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "test-model",
      provider: "byteplus",
      providerModelId: null,
      displayName: "Test Model",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/test",
      },
      modelParameter: {
        path: ["model"],
        source: "runtime",
      },
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds,
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

function createImageModel(
  fields: [GenerationFieldSpec, ...GenerationFieldSpec[]],
): PublishedGenerationModelSummary {
  const model = createModel(fields);

  return {
    ...model,
    id: "nano-banana-2",
    providerId: "google",
    providerName: "Google",
    displayName: "Nano Banana 2",
    type: "image",
    latestSpecId: "nano-banana-2-v1",
    spec: {
      ...model.spec,
      id: "nano-banana-2-v1",
      provider: "google",
      providerModelId: "gemini-3.1-flash-image",
      displayName: "Nano Banana 2",
      type: "image",
      transforms: [],
      validationRules: [],
    },
  };
}
