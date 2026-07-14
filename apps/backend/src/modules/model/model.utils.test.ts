import { describe, expect, it } from "vitest";

import {
  attachmentMediaRoles,
  generationAttachmentMediaRole,
} from "../generation-attachment-media/schema/table.ts";
import { parsePersistedVideoModelSpec } from "./model.utils.ts";

import type {
  VideoAttachmentMediaFieldSpec,
  VideoFieldSpec,
  VideoModelSpec,
} from "./model.types.ts";

describe("model spec utilities", () => {
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
          } as unknown as VideoFieldSpec,
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
          } as unknown as VideoFieldSpec,
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
          } as unknown as VideoFieldSpec,
        ]),
      ),
    ).toThrow("fields.0.mediaRoleCapabilities.0: Invalid option");
  });

  it("allows non-media fields without role capabilities", () => {
    expect(parsePersistedVideoModelSpec(createVideoSpec()).fields[0]).toEqual(
      createPromptField(),
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

function createPromptField(): VideoFieldSpec {
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

function createMediaField(
  overrides: Partial<VideoAttachmentMediaFieldSpec> = {},
): VideoAttachmentMediaFieldSpec {
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
