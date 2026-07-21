import { describe, expect, it, vi } from "vitest";

import type { ImageModelSpec } from "../../../model/model.types.ts";
import { GoogleProviderError } from "./google.types.ts";
import { GoogleService } from "./google.service.ts";

describe("GoogleService", () => {
  it("calls the stable Interactions endpoint with API-key authentication", async () => {
    const fetcher = createFetchMock(createCompletedResponse());
    const service = createService(fetcher);

    const result = await service.generateImage(createGenerateImageInput());

    expect(result).toMatchObject({
      provider: "google",
      providerTaskId: "interaction-1",
      providerModelId: "gemini-3.1-flash-image",
      image: { contentType: "image/jpeg" },
      receivedAt: "2026-07-20T12:00:00.000Z",
    });
    expect(fetcher).toHaveBeenCalledOnce();

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://gemini.example.test/v1/interactions");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": "gemini-test-key",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "gemini-3.1-flash-image",
      input: [
        {
          type: "user_input",
          content: [
            { type: "text", text: "A paper-cut landscape" },
            {
              type: "image",
              uri: "https://storage.example.test/reference.png?signature=test",
              mime_type: "image/png",
            },
          ],
        },
      ],
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: "4:3",
        image_size: "1K",
      },
      store: false,
    });
  });

  it("reads provider configuration lazily", async () => {
    const service = new GoogleService({
      environment: {},
      fetcher: createFetchMock(createCompletedResponse()),
    });

    await expect(
      service.generateImage(createGenerateImageInput()),
    ).rejects.toMatchObject({
      name: "GoogleProviderError",
      code: "PROVIDER_NOT_CONFIGURED",
      statusCode: null,
    });
  });

  it("does not retry an ambiguous network failure", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("request body may have been sent");
    }) as unknown as FetchMock;
    const service = createService(fetcher);

    await expect(
      service.generateImage(createGenerateImageInput()),
    ).rejects.toMatchObject({
      name: "GoogleProviderError",
      code: "NETWORK_ERROR",
      statusCode: null,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("returns actionable safe HTTP details without exposing payload data", async () => {
    const fetcher = createFetchMock(
      {
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          message:
            "private prompt A paper-cut landscape, gemini-test-key, signed URL",
        },
      },
      429,
    );
    const service = createService(fetcher);

    let error: unknown;

    try {
      await service.generateImage(createGenerateImageInput());
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(GoogleProviderError);
    expect(error).toMatchObject({
      name: "GoogleProviderError",
      message:
        "Google image request was rejected: private prompt [redacted], [redacted], signed URL (HTTP 429, code RESOURCE_EXHAUSTED)",
      code: "RESOURCE_EXHAUSTED",
      statusCode: 429,
      interactionStatus: null,
      providerMessage: "private prompt [redacted], [redacted], signed URL",
    });
    expect(JSON.stringify(error)).not.toContain("A paper-cut landscape");
    expect(JSON.stringify(error)).not.toContain("gemini-test-key");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not retry server errors", async () => {
    const fetcher = createFetchMock({ error: { status: "INTERNAL" } }, 503);
    const service = createService(fetcher);

    await expect(
      service.generateImage(createGenerateImageInput()),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      statusCode: 503,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects malformed JSON without including the response body", async () => {
    const fetcher = vi.fn(
      async () => new Response("private prompt and base64", { status: 200 }),
    ) as unknown as FetchMock;
    const service = createService(fetcher);

    await expect(
      service.generateImage(createGenerateImageInput()),
    ).rejects.toMatchObject({
      name: "GoogleProviderError",
      message: "Google image response was not valid JSON",
      code: "INVALID_JSON",
      statusCode: 200,
    });
  });

  it("uses the job id to correlate a stateless response without an interaction id", async () => {
    const fetcher = createFetchMock(createCompletedResponse({ id: undefined }));
    const service = createService(fetcher);

    await expect(
      service.generateImage(createGenerateImageInput()),
    ).resolves.toMatchObject({
      providerTaskId: "google-stateless:image-job-1",
      rawPayload: { id: null },
    });
  });
});

type FetchMock = typeof fetch & {
  mock: {
    calls: Parameters<typeof fetch>[];
  };
};

function createFetchMock(body: unknown, status = 200): FetchMock {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as FetchMock;
}

function createService(fetcher: FetchMock) {
  return new GoogleService({
    environment: {
      GEMINI_API_KEY: "gemini-test-key",
      GEMINI_API_BASE_URL: "https://gemini.example.test",
    },
    fetcher,
    now: () => new Date("2026-07-20T12:00:00.000Z"),
  });
}

function createGenerateImageInput() {
  return {
    jobId: "image-job-1",
    spec: createGoogleSpec(),
    input: {
      submittedInput: {
        prompt: "A paper-cut landscape",
        resolution: "1K",
        aspectRatio: "4:3",
      },
      attachmentMedia: [
        {
          fieldId: "images" as const,
          role: "reference" as const,
          url: "https://storage.example.test/reference.png?signature=test",
          contentType: "image/png",
          contentLength: 2_048,
        },
      ],
    },
  };
}

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
        omitWhenEmpty: false,
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
