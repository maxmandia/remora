import type {
  GenerationFieldSpec,
  PublishedGenerationModelSummary,
} from "@remora/domain/generation-model/dto";
import type {
  Model3dGenerationThreadSubmission,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import { describe, expect, it } from "vitest";

import {
  getDefaultGenerationSettings,
  isGenerationPromptValidForModel,
  isGenerationSettingsValidForModel,
  restoreGenerationSettingsFromSubmission,
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

  it("extracts and validates H3.1 model3d settings", () => {
    const model = createModel3dModel();
    const settings = {
      modelType: "model3d" as const,
      textureLevel: "standard" as const,
      faceLimit: 1_500_000,
      geometryQuality: "standard" as const,
      requestedGenerations: 1,
    };

    expect(getDefaultGenerationSettings(model)).toEqual({
      modelType: "model3d",
      textureLevel: "standard",
      faceLimit: null,
      geometryQuality: "standard",
      requestedGenerations: 1,
    });
    expect(isGenerationSettingsValidForModel(model, settings)).toBe(true);
    expect(
      isGenerationSettingsValidForModel(model, {
        ...settings,
        faceLimit: 1_500_001,
      }),
    ).toBe(false);
    expect(
      isGenerationSettingsValidForModel(model, {
        ...settings,
        geometryQuality: "detailed",
        faceLimit: 2_000_000,
      }),
    ).toBe(true);
    expect(
      isGenerationSettingsValidForModel(model, {
        ...settings,
        requestedGenerations: 16,
      }),
    ).toBe(false);
  });

  it("validates prompt presence from the selected model spec", () => {
    const textModel = createModel3dModel();
    const imageModel = createModel3dModel({ promptless: true });

    expect(isGenerationPromptValidForModel(textModel, "A ceramic fox")).toBe(
      true,
    );
    expect(isGenerationPromptValidForModel(textModel, " ")).toBe(false);
    expect(isGenerationPromptValidForModel(textModel, "x".repeat(1_025))).toBe(
      false,
    );
    expect(isGenerationPromptValidForModel(imageModel, "")).toBe(true);
    expect(isGenerationPromptValidForModel(imageModel, "unexpected")).toBe(
      false,
    );
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

  it("restores compatible values and defaults settings removed by a newer spec", () => {
    const model = createModel([
      createField({
        id: "aspectRatio",
        defaultValue: "1:1",
        valueKind: "string",
        options: [
          { label: "Square", value: "1:1" },
          { label: "Wide", value: "16:9" },
        ],
      }),
      createField({
        id: "resolution",
        defaultValue: "1080p",
        valueKind: "string",
        options: [{ label: "1080p", value: "1080p" }],
      }),
      createField({
        id: "duration",
        defaultValue: 5,
        valueKind: "integer",
        options: [
          { label: "5s", value: 5 },
          { label: "10s", value: 10 },
        ],
      }),
      createField({
        id: "generateAudio",
        defaultValue: false,
        valueKind: "boolean",
        options: [
          { label: "Off", value: false },
          { label: "On", value: true },
        ],
      }),
    ]);

    expect(
      restoreGenerationSettingsFromSubmission(model, createSubmission()),
    ).toEqual({
      settings: {
        modelType: "video",
        aspectRatio: "16:9",
        resolution: "1080p",
        duration: 10,
        generateAudio: true,
        requestedGenerations: 3,
      },
      wasAdapted: true,
    });
  });

  it("restores model3d settings and adapts invalid face limits", () => {
    expect(
      restoreGenerationSettingsFromSubmission(
        createModel3dModel(),
        createModel3dSubmission(),
      ),
    ).toEqual({
      settings: {
        modelType: "model3d",
        textureLevel: "detailed",
        faceLimit: null,
        geometryQuality: "standard",
        requestedGenerations: 2,
      },
      wasAdapted: true,
    });
  });
});

function createSubmission(): VideoGenerationThreadSubmission {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "test-model",
    modelDisplayName: "Test Model",
    modelType: "video",
    modelSpecId: "test-model-v1",
    submittedInput: {
      prompt: "A glass studio",
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 10,
      generateAudio: true,
      draft: true,
    },
    requestedGenerations: 3,
    attachmentMedia: { images: [], videos: [], audios: [] },
    createdAt: "2026-06-15T11:00:00.000Z",
    updatedAt: "2026-06-15T11:00:00.000Z",
    jobs: [],
  };
}

function createModel3dSubmission(): Model3dGenerationThreadSubmission {
  return {
    id: "submission_model3d",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "tripo-h3-1-text-to-3d",
    modelDisplayName: "Tripo H3.1 Text to 3D",
    modelType: "model3d",
    modelSpecId: "tripo-h3-1-text-to-3d-v1",
    submittedInput: {
      prompt: "A ceramic fox",
      textureLevel: "detailed",
      faceLimit: 1_800_000,
      geometryQuality: "standard",
    },
    requestedGenerations: 2,
    attachmentMedia: { images: [], videos: [], audios: [] },
    createdAt: "2026-06-15T11:00:00.000Z",
    updatedAt: "2026-06-15T11:00:00.000Z",
    jobs: [],
  };
}

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

function createModel3dModel({
  promptless = false,
} = {}): PublishedGenerationModelSummary {
  const outputFields: [GenerationFieldSpec, ...GenerationFieldSpec[]] = [
    createField({
      id: "textureLevel",
      componentKind: "select",
      valueKind: "string",
      defaultValue: "standard",
      options: [
        { label: "None", value: "none" },
        { label: "Standard", value: "standard" },
        { label: "Detailed", value: "detailed" },
      ],
    }),
    createField({
      id: "faceLimit",
      componentKind: "numberInput",
      valueKind: "integer",
      defaultValue: null,
      min: 1,
      max: 2_000_000,
    }),
    createField({
      id: "geometryQuality",
      componentKind: "select",
      valueKind: "string",
      defaultValue: "standard",
      options: [
        { label: "Standard", value: "standard" },
        { label: "Detailed", value: "detailed" },
      ],
    }),
  ];
  const fields: [GenerationFieldSpec, ...GenerationFieldSpec[]] = promptless
    ? outputFields
    : [
        createField({
          id: "prompt",
          required: true,
          maxLength: 1_024,
        }),
        ...outputFields,
      ];
  const fieldIds = fields.map((field) => field.id) as [
    GenerationFieldSpec["id"],
    ...GenerationFieldSpec["id"][],
  ];

  return {
    id: promptless ? "tripo-h3-1-image-to-3d" : "tripo-h3-1-text-to-3d",
    providerId: "tripo",
    providerName: "Tripo",
    displayName: promptless
      ? "Tripo H3.1 Image to 3D"
      : "Tripo H3.1 Text to 3D",
    type: "model3d",
    latestSpecId: promptless
      ? "tripo-h3-1-image-to-3d-v1"
      : "tripo-h3-1-text-to-3d-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: promptless ? "tripo-h3-1-image-to-3d" : "tripo-h3-1-text-to-3d",
      provider: "tripo",
      providerModelId: "v3.1-20260211",
      displayName: promptless
        ? "Tripo H3.1 Image to 3D"
        : "Tripo H3.1 Text to 3D",
      type: "model3d",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: promptless
          ? "/generation/image-to-model"
          : "/generation/text-to-model",
      },
      modelParameter: { path: ["model"], source: "spec" },
      fields,
      groups: [
        {
          id: "output",
          label: "3D output",
          fieldIds,
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}
