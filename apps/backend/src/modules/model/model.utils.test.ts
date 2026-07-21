import { describe, expect, it } from "vitest";

import {
  attachmentMediaRoles,
  generationAttachmentMediaRole,
} from "../generation-attachment-media/schema/table.ts";
import { generationModelAdapter, generationModelType } from "./schema/table.ts";
import {
  parsePersistedGenerationModelSpec,
  parsePersistedImageModelSpec,
  parsePersistedVideoModelSpec,
} from "./model.utils.ts";

import type {
  ImageModelSpec,
  GenerationAttachmentMediaFieldSpec,
  GenerationFieldSpec,
  VideoModelSpec,
} from "./model.types.ts";
import {
  generationModelAdapters,
  generationModelTypes,
} from "./model.types.ts";

describe("model spec utilities", () => {
  it("uses the database enum values as the model type source of truth", () => {
    expect(generationModelType.enumValues).toEqual(generationModelTypes);
    expect(generationModelTypes).toEqual(["video", "image"]);
  });

  it("uses the database enum values as the adapter source of truth", () => {
    expect(generationModelAdapter.enumValues).toEqual(generationModelAdapters);
    expect(generationModelAdapters).toEqual([
      "byteplus_seedance_video",
      "google_gemini_interactions_image",
      "kling_v3_text_to_video",
    ]);
  });

  it("uses the database enum values as the attachment role source of truth", () => {
    expect(attachmentMediaRoles).toBe(generationAttachmentMediaRole.enumValues);
    expect(attachmentMediaRoles).toEqual([
      "reference",
      "firstFrame",
      "lastFrame",
    ]);
  });

  it("parses media-list fields with canonical role capabilities", () => {
    const spec = parsePersistedVideoModelSpec(
      createVideoSpec([
        createMediaField({
          mediaRoleCapabilities: ["firstFrame", "lastFrame", "reference"],
        }),
      ]),
    );

    expect(spec.fields[0]).toMatchObject({
      id: "images",
      componentKind: "mediaList",
      mediaRoleCapabilities: ["firstFrame", "lastFrame", "reference"],
    });
  });

  it("rejects media-list fields missing role capabilities", () => {
    expect(() =>
      parsePersistedVideoModelSpec(
        createVideoSpec([
          {
            ...createMediaField(),
            mediaRoleCapabilities: undefined,
          } as unknown as GenerationFieldSpec,
        ]),
      ),
    ).toThrow("images must declare mediaRoleCapabilities");
  });

  it("rejects media-list fields with empty role capabilities", () => {
    expect(() =>
      parsePersistedVideoModelSpec(
        createVideoSpec([
          {
            ...createMediaField(),
            mediaRoleCapabilities: [],
          } as unknown as GenerationFieldSpec,
        ]),
      ),
    ).toThrow("fields.0.mediaRoleCapabilities");
  });

  it("rejects unsupported media role capabilities", () => {
    expect(() =>
      parsePersistedVideoModelSpec(
        createVideoSpec([
          {
            ...createMediaField(),
            mediaRoleCapabilities: ["startFrame"],
          } as unknown as GenerationFieldSpec,
        ]),
      ),
    ).toThrow("fields.0.mediaRoleCapabilities.0: Invalid option");
  });

  it("allows non-media fields without role capabilities", () => {
    expect(parsePersistedVideoModelSpec(createVideoSpec()).fields[0]).toEqual(
      createPromptField(),
    );
  });

  it("parses image specs through the discriminated model contract", () => {
    const imageSpec = createImageSpec();

    expect(parsePersistedGenerationModelSpec(imageSpec)).toEqual(imageSpec);
    expect(parsePersistedImageModelSpec(imageSpec)).toEqual(imageSpec);
    expect(() => parsePersistedVideoModelSpec(imageSpec)).toThrow(
      "Expected video model spec, received image",
    );
  });
});

function createVideoSpec(
  fields: VideoModelSpec["fields"] = [createPromptField()],
): VideoModelSpec {
  const fieldIds = fields.map((field) => field.id) as [string, ...string[]];

  return {
    schemaVersion: 1,
    id: "seedance-2.0-video",
    provider: "byteplus",
    providerModelId: "dreamina-seedance-2-0-260128",
    displayName: "Seedance 2.0",
    type: "video",
    status: "published",
    sourceUrls: [],
    endpoint: {
      method: "POST",
      path: "/api/v3/contents/generations/tasks",
    },
    modelParameter: {
      path: ["model"],
      source: "spec",
    },
    fields,
    groups: [
      {
        id: "prompt",
        label: "Prompt",
        fieldIds,
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

function createPromptField(): GenerationFieldSpec {
  return {
    id: "prompt",
    label: "Prompt",
    componentKind: "promptTextarea",
    valueKind: "string",
    required: false,
    advanced: false,
    defaultValue: "",
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
  };
}

function createImageSpec(): ImageModelSpec {
  return {
    ...createVideoSpec(),
    id: "nano-banana-2",
    provider: "google",
    providerModelId: "gemini-3.1-flash-image",
    displayName: "Nano Banana 2",
    type: "image",
  };
}

function createMediaField(
  overrides: Partial<GenerationAttachmentMediaFieldSpec> = {},
): GenerationAttachmentMediaFieldSpec {
  return {
    id: "images",
    label: "Images",
    componentKind: "mediaList",
    valueKind: "array",
    required: false,
    advanced: false,
    defaultValue: [],
    omitWhenEmpty: true,
    omitWhenDefault: false,
    arrayMax: 9,
    mediaRoleCapabilities: ["reference"],
    notes: [],
    ...overrides,
  };
}
