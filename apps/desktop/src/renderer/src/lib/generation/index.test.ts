import { describe, expect, it } from "vitest";

import { getDefaultGenerationSettings } from "./index.ts";

import type {
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";

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
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
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
      aspectRatio: "9:16",
      duration: 10,
      generateAudio: false,
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
});

function createField(overrides: Partial<VideoFieldSpec> = {}): VideoFieldSpec {
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
  };
}

function createModel(
  fields: [VideoFieldSpec, ...VideoFieldSpec[]],
): PublishedGenerationModelSummary {
  const fieldIds = fields.map((field) => field.id) as [
    VideoFieldSpec["id"],
    ...VideoFieldSpec["id"][],
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
