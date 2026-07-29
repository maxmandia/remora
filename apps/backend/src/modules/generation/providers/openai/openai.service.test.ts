import { describe, expect, it, vi } from "vitest";

import type { ImageModelSpec } from "../../../model/model.types.ts";
import { OpenAIService } from "./openai.service.ts";

describe("OpenAIService", () => {
  it("uses image generation for text-only requests", async () => {
    const generate = vi.fn(async () => createResponse());
    const post = vi.fn();
    const service = createService({ generate, post });

    const result = await service.generateImage(createInput());

    expect(generate).toHaveBeenCalledWith(
      {
        model: "gpt-image-2-2026-04-21",
        prompt: "A paper-cut landscape",
        n: 1,
        quality: "high",
        output_format: "jpeg",
        size: "1024x1024",
      },
      { maxRetries: 0 },
    );
    expect(post).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: "openai",
      providerTaskId: "openai-stateless:image-job-1",
      receivedAt: "2026-07-29T12:00:00.000Z",
    });
  });

  it("uses JSON image URL references for edits", async () => {
    const generate = vi.fn();
    const post = vi.fn(async () => createResponse());
    const service = createService({ generate, post });

    await service.generateImage(
      createInput({
        attachmentMedia: [
          {
            fieldId: "images",
            role: "reference",
            url: "https://storage.example.test/reference.png?signature=one",
            contentType: "image/png",
            contentLength: 2_048,
          },
        ],
      }),
    );

    expect(post).toHaveBeenCalledWith("/images/edits", {
      body: expect.objectContaining({
        model: "gpt-image-2-2026-04-21",
        images: [
          {
            image_url:
              "https://storage.example.test/reference.png?signature=one",
          },
        ],
      }),
      maxRetries: 0,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    [429, true],
    [503, true],
    [400, false],
    [401, false],
  ])("classifies HTTP %s retryability", async (status, retryable) => {
    const prompt = "A paper-cut landscape";
    const generate = vi.fn(async () => {
      throw {
        status,
        code: "provider_code",
        requestID: "request-1",
        message: `Rejected ${prompt} at https://private.example.test`,
      };
    });
    const service = createService({ generate, post: vi.fn() });

    await expect(service.generateImage(createInput())).rejects.toMatchObject({
      name: "OpenAIProviderError",
      statusCode: status,
      retryable,
      requestId: "request-1",
      providerMessage: "Rejected [redacted] at [redacted-url]",
    });
  });

  it("classifies connection failures as retryable without leaking details", async () => {
    const generate = vi.fn(async () => {
      throw new TypeError("socket closed");
    });
    const service = createService({ generate, post: vi.fn() });

    await expect(service.generateImage(createInput())).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      retryable: true,
      statusCode: null,
    });
  });

  it("treats missing provider configuration as non-retryable", async () => {
    const service = new OpenAIService({
      clientFactory: () => {
        throw new Error("OPENAI_API_KEY is missing");
      },
    });

    await expect(service.generateImage(createInput())).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONFIGURED",
      retryable: false,
      statusCode: null,
    });
  });
});

function createService({
  generate,
  post,
}: {
  generate: (input: never) => Promise<unknown>;
  post: (path: string, options: never) => Promise<unknown> | undefined;
}) {
  return new OpenAIService({
    clientFactory: () =>
      ({
        images: { generate },
        post,
      }) as never,
    now: () => new Date("2026-07-29T12:00:00.000Z"),
  });
}

function createInput({
  attachmentMedia = [],
}: {
  attachmentMedia?: Array<{
    fieldId: "images";
    role: "reference";
    url: string;
    contentType: string;
    contentLength: number;
  }>;
} = {}) {
  return {
    jobId: "image-job-1",
    spec: createSpec(),
    input: {
      submittedInput: {
        prompt: "A paper-cut landscape",
        resolution: "standard",
        aspectRatio: "1:1",
      },
      attachmentMedia,
    },
  };
}

function createSpec(): ImageModelSpec {
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
        omitWhenEmpty: true,
        omitWhenDefault: false,
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

function createResponse() {
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
      input_tokens: 10,
      input_tokens_details: { text_tokens: 10, image_tokens: 0 },
      output_tokens: 7_024,
      total_tokens: 7_034,
    },
  };
}
