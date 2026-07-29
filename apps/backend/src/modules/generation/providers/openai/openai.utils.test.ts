import { describe, expect, it } from "vitest";

import type { ImageModelSpec } from "../../../model/model.types.ts";
import type { OpenAISignedImageAttachment } from "./openai.types.ts";
import {
  buildOpenAIImageRequest,
  maxOpenAIReferenceImageBytes,
  parseOpenAIImageResponse,
  validateOpenAIGptImage2Model,
} from "./openai.utils.ts";

describe("validateOpenAIGptImage2Model", () => {
  it("accepts the canonical GPT Image 2 High configuration", () => {
    expect(
      validateOpenAIGptImage2Model({
        model: { providerId: "openai", type: "image" },
        spec: createOpenAISpec(),
      }),
    ).toEqual([]);
  });

  it("rejects incompatible provider and model configuration", () => {
    expect(
      validateOpenAIGptImage2Model({
        model: { providerId: "google", type: "image" },
        spec: {
          ...createOpenAISpec(),
          providerModelId: "gpt-image-2",
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("is not compatible with google/image"),
        expect.stringContaining(
          "requires providerModelId gpt-image-2-2026-04-21",
        ),
      ]),
    );
  });
});

describe("buildOpenAIImageRequest", () => {
  it.each([
    ["1:1", "1024x1024"],
    ["3:2", "1536x1024"],
    ["2:3", "1024x1536"],
  ] as const)("maps %s to %s", (aspectRatio, size) => {
    expect(
      buildOpenAIImageRequest({
        spec: createOpenAISpec(),
        input: {
          submittedInput: {
            prompt: "  A glass sculpture  ",
            resolution: "standard",
            aspectRatio,
          },
          attachmentMedia: [],
        },
      }),
    ).toEqual({
      model: "gpt-image-2-2026-04-21",
      prompt: "A glass sculpture",
      n: 1,
      quality: "high",
      output_format: "jpeg",
      size,
    });
  });

  it("routes references through the JSON edit shape", () => {
    expect(
      buildOpenAIImageRequest({
        spec: createOpenAISpec(),
        input: {
          submittedInput: {
            prompt: "Restyle this image",
            resolution: "standard",
            aspectRatio: "1:1",
          },
          attachmentMedia: [
            {
              fieldId: "images",
              role: "reference",
              url: "https://storage.example.test/reference.webp?signature=one",
              contentType: "image/webp",
              contentLength: maxOpenAIReferenceImageBytes,
            },
          ],
        },
      }),
    ).toMatchObject({
      images: [
        {
          image_url:
            "https://storage.example.test/reference.webp?signature=one",
        },
      ],
    });
  });

  it.each([
    ["unsupported aspect ratio", { aspectRatio: "16:9" }, []],
    ["unsupported resolution", { resolution: "2K" }, []],
    [
      "oversized reference",
      {},
      [
        {
          fieldId: "images",
          role: "reference",
          url: "https://storage.example.test/reference.png",
          contentType: "image/png",
          contentLength: maxOpenAIReferenceImageBytes + 1,
        },
      ],
    ],
  ])("rejects an %s", (_name, submittedOverrides, attachmentMedia) => {
    expect(() =>
      buildOpenAIImageRequest({
        spec: createOpenAISpec(),
        input: {
          submittedInput: {
            prompt: "Generate an image",
            resolution: "standard",
            aspectRatio: "1:1",
            ...submittedOverrides,
          },
          attachmentMedia: attachmentMedia as OpenAISignedImageAttachment[],
        },
      }),
    ).toThrow("OpenAI image request is invalid");
  });
});

describe("parseOpenAIImageResponse", () => {
  it("returns JPEG bytes, complete usage, and sanitized metadata", () => {
    const result = parseOpenAIImageResponse({
      value: createResponse(),
      providerTaskId: "openai-stateless:job-1",
      providerModelId: "gpt-image-2-2026-04-21",
      expectedSize: "1024x1024",
      receivedAt: "2026-07-29T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      provider: "openai",
      providerTaskId: "openai-stateless:job-1",
      providerModelId: "gpt-image-2-2026-04-21",
      image: {
        contentType: "image/jpeg",
        contentLength: 4,
      },
      usage: {
        inputTokens: 30,
        inputTextTokens: 10,
        inputImageTokens: 20,
        outputImageTokens: 7_024,
        totalTokens: 7_054,
      },
      rawPayload: {
        created: 1_785_283_200,
        outputFormat: "jpeg",
        quality: "high",
        size: "1024x1024",
        output: { imageCount: 1 },
      },
    });
    expect(JSON.stringify(result.rawPayload)).not.toContain("b64_json");
  });

  it.each([
    ["missing usage", { usage: undefined }],
    [
      "inconsistent usage",
      {
        usage: {
          input_tokens: 31,
          input_tokens_details: { text_tokens: 10, image_tokens: 20 },
          output_tokens: 7_024,
          total_tokens: 7_055,
        },
      },
    ],
    ["malformed JPEG", { data: [{ b64_json: "cHJpdmF0ZQ==" }] }],
  ])("rejects %s", (_name, overrides) => {
    expect(() =>
      parseOpenAIImageResponse({
        value: createResponse(overrides),
        providerTaskId: "openai-stateless:job-1",
        providerModelId: "gpt-image-2-2026-04-21",
        expectedSize: "1024x1024",
        receivedAt: "2026-07-29T12:00:00.000Z",
      }),
    ).toThrow(/malformed/i);
  });
});

function createOpenAISpec(): ImageModelSpec {
  return {
    schemaVersion: 1,
    id: "gpt-image-2-high",
    provider: "openai",
    providerModelId: "gpt-image-2-2026-04-21",
    displayName: "GPT Image 2 High",
    type: "image",
    status: "published",
    sourceUrls: [],
    endpoint: { method: "POST", path: "/v1/images/generations" },
    modelParameter: { path: ["model"], source: "spec" },
    fields: [
      {
        id: "prompt",
        label: "Prompt",
        componentKind: "promptTextarea",
        valueKind: "string",
        required: true,
        advanced: false,
        defaultValue: "",
        maxLength: 32_000,
        omitWhenEmpty: true,
        omitWhenDefault: false,
        notes: [],
      },
      {
        id: "images",
        label: "Images",
        componentKind: "mediaList",
        valueKind: "array",
        required: false,
        advanced: false,
        defaultValue: [],
        arrayMax: 16,
        mediaConstraints: {
          mimeTypes: ["image/jpeg", "image/png", "image/webp"],
          extensions: [".jpeg", ".jpg", ".png", ".webp"],
          maxFileSizeBytes: 50 * 1024 * 1024,
        },
        mediaRoleCapabilities: ["reference"],
        omitWhenEmpty: true,
        omitWhenDefault: false,
        notes: [],
      },
      {
        id: "resolution",
        label: "Resolution",
        componentKind: "hidden",
        valueKind: "string",
        required: false,
        advanced: false,
        defaultValue: "standard",
        omitWhenEmpty: true,
        omitWhenDefault: false,
        notes: [],
      },
      {
        id: "aspectRatio",
        label: "Aspect ratio",
        componentKind: "select",
        valueKind: "string",
        required: false,
        advanced: false,
        defaultValue: "1:1",
        options: [
          { label: "1:1", value: "1:1" },
          { label: "3:2", value: "3:2" },
          { label: "2:3", value: "2:3" },
        ],
        omitWhenEmpty: true,
        omitWhenDefault: false,
        notes: [],
      },
    ],
    groups: [
      {
        id: "input",
        label: "Input",
        fieldIds: ["prompt", "images", "resolution", "aspectRatio"],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

function createResponse(overrides: Record<string, unknown> = {}) {
  return {
    created: 1_785_283_200,
    data: [
      {
        b64_json: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
      },
    ],
    output_format: "jpeg",
    quality: "high",
    size: "1024x1024",
    usage: {
      input_tokens: 30,
      input_tokens_details: { text_tokens: 10, image_tokens: 20 },
      output_tokens: 7_024,
      total_tokens: 7_054,
    },
    ...overrides,
  };
}
