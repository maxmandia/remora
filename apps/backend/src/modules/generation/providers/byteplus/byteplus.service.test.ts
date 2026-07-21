import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  GenerationFieldSpec,
  VideoModelSpec,
} from "../../../model/model.types.ts";
import { ProviderHttpError } from "../provider-http.ts";
import { BytePlusService } from "./byteplus.service.ts";

describe("BytePlusService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("maps canonical inputs and attachment media into a Seedance task", async () => {
    const fetcher = vi.fn(async (_url: URL | string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        model: "dreamina-seedance-2-0-260128",
        content: [
          { type: "text", text: "A cinematic product shot" },
          {
            type: "image_url",
            image_url: { url: "https://assets.example/reference.png" },
            role: "reference_image",
          },
          {
            type: "video_url",
            video_url: { url: "https://assets.example/reference.mp4" },
            role: "reference_video",
          },
          {
            type: "audio_url",
            audio_url: { url: "https://assets.example/reference.mp3" },
            role: "reference_audio",
          },
        ],
        resolution: "1080p",
        ratio: "16:9",
        duration: 8,
        generate_audio: false,
        callback_url: "https://api.example.test/callback",
      });

      return new Response(JSON.stringify({ id: "cgt-123" }), {
        status: 200,
      });
    });
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "ark-test-key");
    vi.stubEnv("BYTEPLUS_ARK_BASE_URL", "https://ark.example.test/api/v3");
    vi.stubGlobal("fetch", fetcher);

    const service = new BytePlusService();

    await expect(
      service.createVideoTask({
        spec: createSeedanceSpec(),
        input: {
          jobId: "job_1",
          modelId: "seedance-2.0-video",
          modelSpecId: "seedance-2.0-video-v1",
          submittedInput: {
            prompt: "A cinematic product shot",
            resolution: "1080p",
            aspectRatio: "16:9",
            duration: 8,
            generateAudio: false,
          },
          attachmentMedia: [
            {
              fieldId: "images",
              role: "reference",
              url: "https://assets.example/reference.png",
              contentType: "image/png",
              contentLength: 1_024,
            },
            {
              fieldId: "videos",
              role: "reference",
              url: "https://assets.example/reference.mp4",
              contentType: "video/mp4",
              contentLength: 4_096,
            },
            {
              fieldId: "audios",
              role: "reference",
              url: "https://assets.example/reference.mp3",
              contentType: "audio/mpeg",
              contentLength: 512,
            },
          ],
          callbackUrl: "https://api.example.test/callback",
        },
      }),
    ).resolves.toEqual({
      provider: "byteplus",
      providerTaskId: "cgt-123",
      providerModelId: "dreamina-seedance-2-0-260128",
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      "https://ark.example.test/api/v3/contents/generations/tasks",
    );
  });

  it("propagates normalized provider errors from task creation", async () => {
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "ark-test-key");
    vi.stubEnv("BYTEPLUS_ARK_BASE_URL", "https://ark.example.test/api/v3");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "InvalidParameter",
                message: "Unsupported reference input",
              },
            }),
            { status: 400 },
          ),
      ),
    );

    const service = new BytePlusService();

    await expect(
      service.createVideoTask({
        spec: createSeedanceSpec(),
        input: {
          jobId: "job_1",
          modelId: "seedance-2.0-video",
          modelSpecId: "seedance-2.0-video-v1",
          submittedInput: {
            prompt: "A cinematic product shot",
            resolution: "1080p",
            aspectRatio: "16:9",
            duration: 8,
            generateAudio: false,
          },
          attachmentMedia: [],
          callbackUrl: "https://api.example.test/callback",
        },
      }),
    ).rejects.toMatchObject({
      name: "ProviderHttpError",
      statusCode: 400,
      code: "InvalidParameter",
      providerMessage: "Unsupported reference input",
    });
  });

  it("normalizes callback payloads without requiring provider configuration", () => {
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "");

    const service = new BytePlusService();

    expect(
      service.normalizeVideoTaskResult({
        id: "cgt-123",
        model: "dreamina-seedance-2-0-260128",
        status: "succeeded",
        content: { video_url: "https://assets.example/result.mp4" },
        usage: { completion_tokens: 120, total_tokens: 120 },
        created_at: 1743414619,
        updated_at: 1743414673,
      }),
    ).toEqual({
      provider: "byteplus",
      providerTaskId: "cgt-123",
      providerModelId: "dreamina-seedance-2-0-260128",
      status: "succeeded",
      videoUrl: "https://assets.example/result.mp4",
      usage: { completionTokens: 120, totalTokens: 120 },
      createdAt: 1743414619,
      updatedAt: 1743414673,
      providerError: null,
    });
  });

  it("rejects malformed callback payloads", () => {
    const service = new BytePlusService();

    expect(() => service.normalizeVideoTaskResult({ id: "cgt-123" })).toThrow(
      ProviderHttpError,
    );
  });
});

function createSeedanceSpec(): VideoModelSpec {
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
    fields: [
      createField({
        id: "resolution",
        providerPath: ["resolution"],
        valueKind: "string",
      }),
      createField({
        id: "aspectRatio",
        providerPath: ["ratio"],
        valueKind: "string",
      }),
      createField({
        id: "duration",
        providerPath: ["duration"],
        valueKind: "integer",
      }),
      createField({
        id: "generateAudio",
        providerPath: ["generate_audio"],
        valueKind: "boolean",
      }),
      createField({
        id: "callbackUrl",
        providerPath: ["callback_url"],
        valueKind: "string",
      }),
    ],
    groups: [
      {
        id: "main",
        label: "Main",
        fieldIds: ["duration"],
        advanced: false,
      },
    ],
    transforms: [{ kind: "seedanceContentArray" }],
    validationRules: ["seedance20ContentRules"],
  };
}

function createField(overrides: Partial<GenerationFieldSpec>): GenerationFieldSpec {
  return {
    id: "duration",
    label: "Duration",
    componentKind: "select",
    valueKind: "integer",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  } as GenerationFieldSpec;
}
