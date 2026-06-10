import { describe, expect, it } from "vitest";

import {
  ModelFieldPayloadBuilder,
  ModelFieldPayloadError,
} from "./model-field-payload.ts";

import type { ModelFieldPayloadValue } from "./model-field-payload.ts";
import type { VideoFieldSpec } from "../model/types.ts";

describe("model field payload utilities", () => {
  it("sets nested provider paths", () => {
    const payload: Record<string, unknown> = {};
    const builder = new ModelFieldPayloadBuilder(payload);

    builder.setProviderValue(["input", "options", "duration"], 8);

    expect(payload).toEqual({
      input: {
        options: {
          duration: 8,
        },
      },
    });
  });

  it("applies model field values through provider paths", () => {
    const payload: Record<string, unknown> = {};
    const builder = new ModelFieldPayloadBuilder(payload);

    builder.applyFieldValues({
      fields: [
        createField({
          id: "aspectRatio",
          valueKind: "string",
          providerPath: ["ratio"],
        }),
        createField({
          id: "generateAudio",
          valueKind: "boolean",
          providerPath: ["audio"],
          providerValueMap: [
            {
              canonicalValue: true,
              providerValue: "on",
            },
          ],
        }),
      ],
      values: new Map<string, ModelFieldPayloadValue>([
        ["aspectRatio", "16:9"],
        ["generateAudio", true],
      ]),
    });

    expect(payload).toEqual({
      ratio: "16:9",
      audio: "on",
    });
  });

  it("validates primitive value kinds", () => {
    const builder = new ModelFieldPayloadBuilder({});

    expect(() =>
      builder.applyFieldValues({
        fields: [
          createField({
            id: "duration",
            valueKind: "integer",
            providerPath: ["duration"],
          }),
        ],
        values: new Map<string, ModelFieldPayloadValue>([["duration", 4.5]]),
      }),
    ).toThrow(ModelFieldPayloadError);

    expect(() =>
      builder.applyFieldValues({
        fields: [
          createField({
            id: "enabled",
            valueKind: "boolean",
            providerPath: ["enabled"],
          }),
        ],
        values: new Map<string, ModelFieldPayloadValue>([["enabled", "true"]]),
      }),
    ).toThrow("enabled must be a boolean");
  });

  it("validates numeric and string bounds", () => {
    const builder = new ModelFieldPayloadBuilder({});

    expect(() =>
      builder.applyFieldValues({
        fields: [
          createField({
            id: "duration",
            valueKind: "integer",
            min: 4,
            max: 15,
            providerPath: ["duration"],
          }),
        ],
        values: new Map<string, ModelFieldPayloadValue>([["duration", 16]]),
      }),
    ).toThrow("duration must be less than or equal to 15");

    expect(() =>
      builder.applyFieldValues({
        fields: [
          createField({
            id: "prompt",
            valueKind: "string",
            minLength: 3,
            maxLength: 10,
            providerPath: ["prompt"],
          }),
        ],
        values: new Map<string, ModelFieldPayloadValue>([["prompt", "hi"]]),
      }),
    ).toThrow("prompt must be at least 3 characters");
  });

  it("validates primitive option values", () => {
    const builder = new ModelFieldPayloadBuilder({});

    expect(() =>
      builder.applyFieldValues({
        fields: [
          createField({
            id: "resolution",
            valueKind: "string",
            providerPath: ["resolution"],
            options: [
              { label: "480p", value: "480p" },
              { label: "720p", value: "720p" },
            ],
          }),
        ],
        values: new Map<string, ModelFieldPayloadValue>([
          ["resolution", "1080p"],
        ]),
      }),
    ).toThrow("resolution must match a supported model option");
  });

  it("omits default and empty values", () => {
    const payload: Record<string, unknown> = {};
    const builder = new ModelFieldPayloadBuilder(payload);

    builder.applyFieldValues({
      fields: [
        createField({
          id: "generateAudio",
          defaultValue: true,
          omitWhenDefault: true,
          providerPath: ["generate_audio"],
          valueKind: "boolean",
        }),
        createField({
          id: "callbackUrl",
          omitWhenEmpty: true,
          providerPath: ["callback_url"],
        }),
      ],
      values: new Map<string, ModelFieldPayloadValue>([
        ["generateAudio", true],
        ["callbackUrl", ""],
      ]),
    });

    expect(payload).toEqual({});
  });

  it("maps provider values from model value maps", () => {
    const payload: Record<string, unknown> = {};
    const builder = new ModelFieldPayloadBuilder(payload);

    builder.applyFieldValues({
      fields: [
        createField({
          id: "generateAudio",
          providerPath: ["generate_audio"],
          valueKind: "boolean",
          providerValueMap: [
            {
              canonicalValue: false,
              providerValue: "off",
            },
          ],
        }),
      ],
      values: new Map<string, ModelFieldPayloadValue>([
        ["generateAudio", false],
      ]),
    });

    expect(payload).toEqual({ generate_audio: "off" });
  });
});

function createField(overrides: Partial<VideoFieldSpec> = {}): VideoFieldSpec {
  return {
    id: "field",
    label: "Field",
    componentKind: "select",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: false,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  };
}
