import { describe, expect, it } from "vitest";

import type { ImageModelSpec } from "../../../model/model.types.ts";
import { GoogleProviderError } from "./google.types.ts";
import {
  buildGoogleImageInteractionRequest,
  maxGoogleReferenceImageBytes,
  parseGoogleImageInteractionResponse,
  validateGoogleGeminiInteractionsImageModel,
} from "./google.utils.ts";

describe("validateGoogleGeminiInteractionsImageModel", () => {
  it("accepts the canonical Google image model configuration", () => {
    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "google", type: "image" },
        spec: createGoogleSpec(),
      }),
    ).toEqual([]);
  });

  it("rejects an incompatible provider, provider model, or endpoint", () => {
    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "kling", type: "image" },
        spec: createGoogleSpec(),
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("is not compatible with kling/image"),
      ]),
    );

    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "google", type: "image" },
        spec: { ...createGoogleSpec(), providerModelId: "gemini-3-pro-image" },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "requires providerModelId gemini-3.1-flash-image",
        ),
      ]),
    );

    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "google", type: "image" },
        spec: {
          ...createGoogleSpec(),
          endpoint: { method: "POST", path: "/v1beta/interactions" },
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("requires POST /v1/interactions endpoint"),
      ]),
    );
  });

  it("rejects an invalid field set or reference-image contract", () => {
    const spec = createGoogleSpec();
    getGoogleField(spec, "images").arrayMax = 15;

    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "google", type: "image" },
        spec,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("must accept up to 14 reference"),
      ]),
    );

    const fieldSpec = createGoogleSpec();
    fieldSpec.fields.pop();

    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "google", type: "image" },
        spec: fieldSpec,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "requires exactly fields prompt, images, resolution, aspectRatio",
        ),
      ]),
    );
  });

  it("rejects invalid resolution and aspect-ratio options", () => {
    const resolutionSpec = createGoogleSpec();
    getGoogleField(resolutionSpec, "resolution").options!.pop();

    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "google", type: "image" },
        spec: resolutionSpec,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("field resolution must default to 1K"),
      ]),
    );

    const aspectRatioSpec = createGoogleSpec();
    getGoogleField(aspectRatioSpec, "aspectRatio").options!.pop();

    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "google", type: "image" },
        spec: aspectRatioSpec,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("field aspectRatio must default to 1:1"),
      ]),
    );
  });

  it("rejects transforms and validation rules", () => {
    const spec = createGoogleSpec();
    spec.transforms = [{ kind: "seedanceContentArray" }];
    spec.validationRules = ["klingTextToVideoRules"];

    expect(
      validateGoogleGeminiInteractionsImageModel({
        model: { providerId: "google", type: "image" },
        spec,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("does not support transforms or rules"),
      ]),
    );
  });
});

describe("buildGoogleImageInteractionRequest", () => {
  it("builds a synchronous inline JPEG request with signed reference images", () => {
    expect(
      buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: {
            prompt: "  Turn these references into a cinematic poster  ",
            resolution: "2K",
            aspectRatio: "16:9",
          },
          attachmentMedia: [
            {
              fieldId: "images",
              role: "reference",
              url: "https://storage.example.test/first.png?signature=one",
              contentType: "image/png",
              contentLength: 1_024,
            },
            {
              fieldId: "images",
              role: "reference",
              url: "https://storage.example.test/second.webp?signature=two",
              contentType: "image/webp",
              contentLength: 2_048,
            },
          ],
        },
      }),
    ).toEqual({
      model: "gemini-3.1-flash-image",
      input: [
        {
          type: "user_input",
          content: [
            {
              type: "text",
              text: "Turn these references into a cinematic poster",
            },
            {
              type: "image",
              uri: "https://storage.example.test/first.png?signature=one",
              mime_type: "image/png",
            },
            {
              type: "image",
              uri: "https://storage.example.test/second.webp?signature=two",
              mime_type: "image/webp",
            },
          ],
        },
      ],
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: "16:9",
        image_size: "2K",
      },
      store: false,
    });
  });

  it.each(["512", "1K", "2K", "4K"])(
    "passes the %s image size to Google without remapping it",
    (resolution) => {
      const request = buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: { ...createSubmittedInput(), resolution },
          attachmentMedia: [],
        },
      });

      expect(request.response_format.image_size).toBe(resolution);
    },
  );

  it.each([
    "1:1",
    "1:4",
    "1:8",
    "2:3",
    "3:2",
    "3:4",
    "4:1",
    "4:3",
    "4:5",
    "5:4",
    "8:1",
    "9:16",
    "16:9",
    "21:9",
  ])(
    "passes the %s aspect ratio to Google without remapping it",
    (aspectRatio) => {
      const request = buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: { ...createSubmittedInput(), aspectRatio },
          attachmentMedia: [],
        },
      });

      expect(request.response_format.aspect_ratio).toBe(aspectRatio);
    },
  );

  it.each([
    ["resolution", { resolution: "1080p" }],
    ["aspect ratio", { aspectRatio: "free" }],
    ["prompt", { prompt: "   " }],
  ])("rejects an unsupported %s", (_field, submittedInput) => {
    expect(() =>
      buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: {
            prompt: "Generate an image",
            resolution: "1K",
            aspectRatio: "1:1",
            ...submittedInput,
          },
          attachmentMedia: [],
        },
      }),
    ).toThrow(GoogleProviderError);
  });

  it("rejects unsupported or oversized reference-image selections", () => {
    expect(() =>
      buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: createSubmittedInput(),
          attachmentMedia: [createAttachment({ contentType: "image/gif" })],
        },
      }),
    ).toThrow("content type is not supported");

    expect(() =>
      buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: createSubmittedInput(),
          attachmentMedia: [
            createAttachment({
              contentLength: maxGoogleReferenceImageBytes,
            }),
            createAttachment({ contentLength: 1 }),
          ],
        },
      }),
    ).toThrow("must total at most");

    expect(() =>
      buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: createSubmittedInput(),
          attachmentMedia: Array.from({ length: 15 }, () => createAttachment()),
        },
      }),
    ).toThrow("at most 14");
  });

  it("rejects non-reference media and non-HTTPS URLs", () => {
    expect(() =>
      buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: createSubmittedInput(),
          attachmentMedia: [createAttachment({ role: "firstFrame" })],
        },
      }),
    ).toThrow("only reference images");

    expect(() =>
      buildGoogleImageInteractionRequest({
        spec: createGoogleSpec(),
        input: {
          submittedInput: createSubmittedInput(),
          attachmentMedia: [
            createAttachment({ url: "http://storage.example.test/image.jpg" }),
          ],
        },
      }),
    ).toThrow("signed HTTPS URL");
  });

  it("rejects a mismatched catalog spec before creating a request", () => {
    expect(() =>
      buildGoogleImageInteractionRequest({
        spec: {
          ...createGoogleSpec(),
          endpoint: { method: "POST", path: "/v1beta/interactions" },
        },
        input: {
          submittedInput: createSubmittedInput(),
          attachmentMedia: [],
        },
      }),
    ).toThrow("configuration is invalid");
  });
});

describe("parseGoogleImageInteractionResponse", () => {
  it("selects the last image in the last model output and normalizes usage", () => {
    const firstImage = Buffer.from("first-image").toString("base64");
    const firstImageInFinalOutput = Buffer.from(
      "first-image-in-final-output",
    ).toString("base64");
    const selectedImage = Buffer.from("selected-image").toString("base64");
    const response = createCompletedResponse({
      model: "models/gemini-3.1-flash-image",
      input: [
        { type: "text", text: "private prompt" },
        {
          type: "image",
          uri: "https://storage.example.test/private.jpg?signature=secret",
        },
      ],
      steps: [
        {
          type: "model_output",
          content: [
            { type: "image", mime_type: "image/jpeg", data: firstImage },
          ],
        },
        {
          type: "thought",
          summary: [
            {
              type: "image",
              mime_type: "image/jpeg",
              data: Buffer.from("thought-image").toString("base64"),
            },
          ],
        },
        {
          type: "model_output",
          content: [
            { type: "text", text: "private generated caption" },
            {
              type: "image",
              mime_type: "image/jpeg",
              data: firstImageInFinalOutput,
            },
            { type: "image", mime_type: "image/jpeg", data: selectedImage },
          ],
        },
      ],
      usage: {
        total_input_tokens: 280,
        output_tokens_by_modality: [
          { modality: "text", tokens: 12 },
          { modality: "image", tokens: 1_000 },
          { modality: "image", tokens: 680 },
        ],
        total_thought_tokens: 42,
        total_tokens: 2_014,
      },
    });

    const result = parseGoogleImageInteractionResponse({
      value: response,
      providerModelId: "gemini-3.1-flash-image",
      receivedAt: "2026-07-20T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      provider: "google",
      providerTaskId: "interaction-1",
      providerModelId: "gemini-3.1-flash-image",
      image: {
        contentType: "image/jpeg",
        contentLength: Buffer.byteLength("selected-image"),
      },
      usage: {
        inputTokens: 280,
        outputTextTokens: 12,
        outputImageTokens: 1_680,
        thoughtTokens: 42,
        totalTokens: 2_014,
      },
      receivedAt: "2026-07-20T12:00:00.000Z",
    });
    expect(result.image.data.equals(Buffer.from("selected-image"))).toBe(true);
    expect(result.rawPayload).toEqual({
      id: "interaction-1",
      model: "models/gemini-3.1-flash-image",
      status: "completed",
      created: "2026-07-20T11:59:59Z",
      updated: "2026-07-20T12:00:00Z",
      usage: {
        inputTokens: 280,
        outputTextTokens: 12,
        outputImageTokens: 1_680,
        thoughtTokens: 42,
        totalTokens: 2_014,
      },
      output: {
        imageCount: 3,
        selectedImageContentType: "image/jpeg",
      },
      steps: [
        {
          type: "model_output",
          content: [{ type: "image", mimeType: "image/jpeg" }],
        },
        { type: "thought", content: [] },
        {
          type: "model_output",
          content: [
            { type: "text", mimeType: null },
            { type: "image", mimeType: "image/jpeg" },
            { type: "image", mimeType: "image/jpeg" },
          ],
        },
      ],
    });

    const serializedPayload = JSON.stringify(result.rawPayload);
    expect(serializedPayload).not.toContain("private prompt");
    expect(serializedPayload).not.toContain("private generated caption");
    expect(serializedPayload).not.toContain("signature=secret");
    expect(serializedPayload).not.toContain(selectedImage);
    expect(serializedPayload).not.toContain(firstImage);
    expect(serializedPayload).not.toContain(firstImageInFinalOutput);
  });

  it.each([
    [
      "non-completed status",
      createCompletedResponse({
        status: "failed",
        error: { status: "SAFETY" },
      }),
      "SAFETY",
    ],
    [
      "missing image",
      createCompletedResponse({
        steps: [{ type: "model_output", content: [{ type: "text" }] }],
      }),
      "MISSING_IMAGE",
    ],
    [
      "wrong image content type",
      createCompletedResponse({
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "image",
                mime_type: "image/png",
                data: Buffer.from("image").toString("base64"),
              },
            ],
          },
        ],
      }),
      "UNSUPPORTED_IMAGE_CONTENT_TYPE",
    ],
    [
      "malformed base64",
      createCompletedResponse({
        steps: [
          {
            type: "model_output",
            content: [
              { type: "image", mime_type: "image/jpeg", data: "not base64" },
            ],
          },
        ],
      }),
      "MALFORMED_IMAGE",
    ],
  ])("rejects a %s response", (_case, response, code) => {
    expect(() =>
      parseGoogleImageInteractionResponse({
        value: response,
        providerModelId: "gemini-3.1-flash-image",
        receivedAt: "2026-07-20T12:00:00.000Z",
      }),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("keeps a completed image when usage is absent", () => {
    const result = parseGoogleImageInteractionResponse({
      value: createCompletedResponse({ usage: undefined }),
      providerModelId: "gemini-3.1-flash-image",
      receivedAt: "2026-07-20T12:00:00.000Z",
    });

    expect(result.usage).toBeNull();
    expect(result.rawPayload.usage).toBeNull();
  });

  it("uses the requested model when Google omits the response model", () => {
    const result = parseGoogleImageInteractionResponse({
      value: createCompletedResponse({ model: undefined }),
      providerModelId: "gemini-3.1-flash-image",
      receivedAt: "2026-07-20T12:00:00.000Z",
    });

    expect(result.providerModelId).toBe("gemini-3.1-flash-image");
    expect(result.rawPayload.model).toBe("gemini-3.1-flash-image");
  });

  it("preserves an opaque interaction id without assuming its character set", () => {
    const providerTaskId = "v1_Chd...=@opaque#interaction?revision=2";
    const result = parseGoogleImageInteractionResponse({
      value: createCompletedResponse({ id: providerTaskId }),
      providerModelId: "gemini-3.1-flash-image",
      receivedAt: "2026-07-20T12:00:00.000Z",
    });

    expect(result.providerTaskId).toBe(providerTaskId);
    expect(result.rawPayload.id).toBe(providerTaskId);
  });

  it("uses the requested JPEG format when Google omits the image MIME type", () => {
    const result = parseGoogleImageInteractionResponse({
      value: createCompletedResponse({
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "image",
                data: Buffer.from("generated-image").toString("base64"),
              },
            ],
          },
        ],
      }),
      providerModelId: "gemini-3.1-flash-image",
      receivedAt: "2026-07-20T12:00:00.000Z",
    });

    expect(result.image.contentType).toBe("image/jpeg");
    expect(result.rawPayload.output.selectedImageContentType).toBe(
      "image/jpeg",
    );
  });

  it.each(["queued", "budget_exceeded"])(
    "treats the %s interaction status as a valid provider response",
    (status) => {
      expect(() =>
        parseGoogleImageInteractionResponse({
          value: createCompletedResponse({ status }),
          providerModelId: "gemini-3.1-flash-image",
          receivedAt: "2026-07-20T12:00:00.000Z",
        }),
      ).toThrow(
        expect.objectContaining({
          code: `INTERACTION_${status.toUpperCase()}`,
          interactionStatus: status,
        }),
      );
    },
  );

  it.each([
    [
      "unsafe interaction id",
      createCompletedResponse({ id: "unsafe\ninteraction" }),
      "interaction id contained control characters",
    ],
    [
      "unknown interaction status",
      createCompletedResponse({ status: "new_status" }),
      "interaction status new_status was unsupported",
    ],
    [
      "missing steps",
      createCompletedResponse({ steps: undefined }),
      "steps were missing or invalid",
    ],
    [
      "URI-only image",
      createCompletedResponse({
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "image",
                mime_type: "image/jpeg",
                uri: "https://example.test/private-output.jpg?token=secret",
              },
            ],
          },
        ],
      }),
      "image contained a URI instead of inline data",
    ],
  ])(
    "identifies a %s without exposing response values",
    (_case, value, reason) => {
      expect(() =>
        parseGoogleImageInteractionResponse({
          value,
          providerModelId: "gemini-3.1-flash-image",
          receivedAt: "2026-07-20T12:00:00.000Z",
        }),
      ).toThrow(
        expect.objectContaining({
          message: `Google interaction response was malformed: ${reason}`,
          code: "MALFORMED_RESPONSE",
        }),
      );

      try {
        parseGoogleImageInteractionResponse({
          value,
          providerModelId: "gemini-3.1-flash-image",
          receivedAt: "2026-07-20T12:00:00.000Z",
        });
      } catch (error) {
        expect(JSON.stringify(error)).not.toContain("private-output");
        expect(JSON.stringify(error)).not.toContain("token=secret");
      }
    },
  );

  it("uses a stable local task id for a stateless response without an id", () => {
    const result = parseGoogleImageInteractionResponse({
      value: createCompletedResponse({ id: undefined }),
      providerModelId: "gemini-3.1-flash-image",
      fallbackProviderTaskId: "google-stateless:image-job-1",
      receivedAt: "2026-07-20T12:00:00.000Z",
    });

    expect(result.providerTaskId).toBe("google-stateless:image-job-1");
    expect(result.rawPayload.id).toBeNull();
  });

  it("rejects an id-less response when no stable fallback is available", () => {
    expect(() =>
      parseGoogleImageInteractionResponse({
        value: createCompletedResponse({ id: undefined }),
        providerModelId: "gemini-3.1-flash-image",
        receivedAt: "2026-07-20T12:00:00.000Z",
      }),
    ).toThrow(
      "Google interaction response was malformed: interaction id and fallback task id were missing",
    );
  });
});

function createGoogleSpec(): ImageModelSpec {
  return {
    schemaVersion: 1,
    id: "nano-banana-2-v1",
    provider: "google",
    providerModelId: "gemini-3.1-flash-image",
    displayName: "Nano Banana 2",
    type: "image",
    status: "published",
    sourceUrls: [],
    endpoint: { method: "POST", path: "/v1/interactions" },
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
        omitWhenEmpty: false,
        omitWhenDefault: false,
        notes: [],
      },
      {
        id: "images",
        label: "Reference images",
        componentKind: "mediaList",
        valueKind: "array",
        required: false,
        advanced: false,
        defaultValue: [],
        omitWhenEmpty: true,
        omitWhenDefault: false,
        arrayMax: 14,
        mediaConstraints: {
          mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/bmp"],
          extensions: [".jpeg", ".jpg", ".png", ".webp", ".bmp"],
          maxFileSizeBytes: 100 * 1024 * 1024,
          maxTotalFileSizeBytes: 100 * 1024 * 1024,
        },
        mediaRoleCapabilities: ["reference"],
        notes: [],
      },
      {
        id: "resolution",
        label: "Resolution",
        componentKind: "select",
        valueKind: "string",
        required: false,
        advanced: false,
        defaultValue: "1K",
        providerPath: ["response_format", "image_size"],
        omitWhenEmpty: true,
        omitWhenDefault: false,
        options: [
          { label: "512", value: "512" },
          { label: "1K", value: "1K" },
          { label: "2K", value: "2K" },
          { label: "4K", value: "4K" },
        ],
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
        providerPath: ["response_format", "aspect_ratio"],
        omitWhenEmpty: true,
        omitWhenDefault: false,
        options: [
          { label: "1:1", value: "1:1" },
          { label: "1:4", value: "1:4" },
          { label: "1:8", value: "1:8" },
          { label: "2:3", value: "2:3" },
          { label: "3:2", value: "3:2" },
          { label: "3:4", value: "3:4" },
          { label: "4:1", value: "4:1" },
          { label: "4:3", value: "4:3" },
          { label: "4:5", value: "4:5" },
          { label: "5:4", value: "5:4" },
          { label: "8:1", value: "8:1" },
          { label: "9:16", value: "9:16" },
          { label: "16:9", value: "16:9" },
          { label: "21:9", value: "21:9" },
        ],
        notes: [],
      },
    ],
    groups: [
      {
        id: "input",
        label: "Input",
        fieldIds: ["prompt"],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

function getGoogleField(spec: ImageModelSpec, fieldId: string) {
  const field = spec.fields.find((candidate) => candidate.id === fieldId);

  if (!field) {
    throw new Error(`Missing Google test field: ${fieldId}`);
  }

  return field;
}

function createSubmittedInput() {
  return {
    prompt: "Generate an image",
    resolution: "1K",
    aspectRatio: "1:1",
  };
}

function createAttachment(
  overrides: Partial<{
    fieldId: "images" | "videos" | "audios";
    role: "reference" | "firstFrame" | "lastFrame";
    url: string;
    contentType: string | null;
    contentLength: number | null;
  }> = {},
) {
  return {
    fieldId: "images" as const,
    role: "reference" as const,
    url: "https://storage.example.test/image.jpg?signature=test",
    contentType: "image/jpeg",
    contentLength: 1_024,
    ...overrides,
  };
}

function createCompletedResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "interaction-1",
    model: "gemini-3.1-flash-image",
    object: "interaction",
    status: "completed",
    created: "2026-07-20T11:59:59Z",
    updated: "2026-07-20T12:00:00Z",
    steps: [
      {
        type: "model_output",
        content: [
          {
            type: "image",
            mime_type: "image/jpeg",
            data: Buffer.from("generated-image").toString("base64"),
          },
        ],
      },
    ],
    usage: {
      total_input_tokens: 10,
      output_tokens_by_modality: [{ modality: "image", tokens: 1_120 }],
      total_thought_tokens: 2,
      total_tokens: 1_132,
    },
    ...overrides,
  };
}
