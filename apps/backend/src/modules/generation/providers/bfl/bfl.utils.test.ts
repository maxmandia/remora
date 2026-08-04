import { describe, expect, it } from "vitest";

import type {
  GenerationFieldSpec,
  VideoModelSpec,
} from "../../../model/model.types.ts";
import { ProviderHttpError } from "../provider-http.ts";
import {
  buildBflVideoTaskRequest,
  normalizeBflVideoTaskResult,
  parseBflCreateVideoTaskResponse,
  toBflProviderError,
  validateBflFlux3VideoModel,
  validateBflPollingUrl,
} from "./bfl.utils.ts";
import { BflPayloadError } from "./bfl.types.ts";

describe("BFL provider utilities", () => {
  it("validates the canonical FLUX 3 model contract", () => {
    expect(
      validateBflFlux3VideoModel({
        model: { providerId: "bfl", type: "video" },
        spec: createBflSpec(),
      }),
    ).toEqual([]);
  });

  it("builds the exact text-to-video request", () => {
    expect(buildBflVideoTaskRequest(createBuildInput())).toEqual({
      prompt: "A glass whale crossing a moonlit harbor",
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "hd",
      version: "latest",
      generate_audio: true,
      safety_tolerance: 4,
      draft: false,
      mode: "t2v",
    });
  });

  it("keeps image keyframes in attachment order", () => {
    expect(
      buildBflVideoTaskRequest(
        createBuildInput({
          attachmentMedia: [
            createAttachment("images", "https://assets.example/third.png"),
            createAttachment("images", "https://assets.example/first.png"),
            createAttachment("images", "https://assets.example/second.png"),
          ],
        }),
      ),
    ).toEqual({
      prompt: "A glass whale crossing a moonlit harbor",
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "hd",
      version: "latest",
      generate_audio: true,
      safety_tolerance: 4,
      draft: false,
      mode: "i2v",
      keyframes: [
        "https://assets.example/third.png",
        "https://assets.example/first.png",
        "https://assets.example/second.png",
      ],
    });
  });

  it("builds video continuation and enforces its duration limit", () => {
    const attachmentMedia = [
      createAttachment("videos", "https://assets.example/start.mp4"),
    ];

    expect(
      buildBflVideoTaskRequest(
        createBuildInput({
          attachmentMedia,
          submittedInput: {
            prompt: "Continue into the sunrise",
            resolution: "fhd",
            aspectRatio: "21:9",
            duration: 15,
            generateAudio: false,
          },
        }),
      ),
    ).toEqual({
      prompt: "Continue into the sunrise",
      aspect_ratio: "21:9",
      duration: 15,
      resolution: "fhd",
      version: "latest",
      generate_audio: false,
      safety_tolerance: 4,
      draft: false,
      mode: "v2v",
      start_video: "https://assets.example/start.mp4",
    });

    expect(() =>
      buildBflVideoTaskRequest(
        createBuildInput({
          attachmentMedia,
          submittedInput: {
            ...createBuildInput().input.submittedInput,
            duration: 16,
          },
        }),
      ),
    ).toThrow("5 to 15 seconds");
  });

  it.each([
    {
      name: "mixed images and videos",
      attachments: [
        createAttachment("images", "https://assets.example/frame.png"),
        createAttachment("videos", "https://assets.example/start.mp4"),
      ],
    },
    {
      name: "multiple videos",
      attachments: [
        createAttachment("videos", "https://assets.example/one.mp4"),
        createAttachment("videos", "https://assets.example/two.mp4"),
      ],
    },
    {
      name: "audio attachments",
      attachments: [
        createAttachment("audios", "https://assets.example/reference.mp3"),
      ],
    },
  ])("rejects $name", ({ attachments }) => {
    expect(() =>
      buildBflVideoTaskRequest(
        createBuildInput({ attachmentMedia: attachments }),
      ),
    ).toThrow(BflPayloadError);
  });

  it("parses creation responses with polling metadata", () => {
    expect(
      parseBflCreateVideoTaskResponse({
        id: "task-1",
        polling_url: "https://api.bfl.ai/v1/get_result?id=task-1",
      }),
    ).toEqual({
      provider: "bfl",
      providerTaskId: "task-1",
      providerModelId: "latest",
      pollingUrl: "https://api.bfl.ai/v1/get_result?id=task-1",
    });
  });

  it.each([
    ["Pending", "running"],
    ["Reasoning", "running"],
    ["Generating", "running"],
    ["Request Moderated", "failed"],
    ["Content Moderated", "failed"],
    ["Task not found", "failed"],
    ["Error", "failed"],
    ["Failed", "failed"],
  ] as const)("normalizes %s as %s", (providerStatus, status) => {
    expect(
      normalizeBflVideoTaskResult({
        expectedProviderTaskId: "task-1",
        providerModelId: "latest",
        value: { id: "task-1", status: providerStatus },
      }),
    ).toMatchObject({
      provider: "bfl",
      providerTaskId: "task-1",
      status,
    });
  });

  it("normalizes task-not-found responses without an echoed task id", () => {
    expect(
      normalizeBflVideoTaskResult({
        expectedProviderTaskId: "task-1",
        providerModelId: "latest",
        value: { status: "Task not found" },
      }),
    ).toMatchObject({
      providerTaskId: "task-1",
      status: "failed",
      providerError: { code: "TASK_NOT_FOUND" },
    });
  });

  it("normalizes ready results with their sample URL", () => {
    expect(
      normalizeBflVideoTaskResult({
        expectedProviderTaskId: "task-1",
        providerModelId: "latest",
        value: {
          id: "task-1",
          status: "Ready",
          result: { sample: "https://delivery.bfl.ai/result.mp4" },
        },
      }),
    ).toMatchObject({
      status: "succeeded",
      videoUrl: "https://delivery.bfl.ai/result.mp4",
    });
  });

  it.each([
    { id: "task-2", status: "Pending" },
    { id: "task-1", status: "Ready", result: {} },
    { id: "task-1", status: "Unknown" },
    null,
  ])("rejects malformed result envelopes", (value) => {
    expect(() =>
      normalizeBflVideoTaskResult({
        expectedProviderTaskId: "task-1",
        providerModelId: "latest",
        value,
      }),
    ).toThrow(BflPayloadError);
  });

  it("allows only HTTPS BFL API polling hosts", () => {
    expect(
      validateBflPollingUrl(
        "https://api.us.bfl.ai/v1/get_result?id=task-1",
        "https://api.bfl.ai",
      ),
    ).toBe("https://api.us.bfl.ai/v1/get_result?id=task-1");

    for (const url of [
      "http://api.bfl.ai/v1/get_result?id=task-1",
      "https://api.bfl.ai.attacker.example/v1/get_result?id=task-1",
      "https://example.com/v1/get_result?id=task-1",
    ]) {
      expect(() => validateBflPollingUrl(url, "https://api.bfl.ai")).toThrow(
        "host was not allowed",
      );
    }
  });

  it.each([
    [401, false],
    [422, false],
    [429, true],
    [500, true],
  ])("classifies HTTP %s retryability", (statusCode, retryable) => {
    expect(
      toBflProviderError(
        new ProviderHttpError("BFL", "request failed", {
          statusCode,
          code: "provider_error",
          providerMessage: "Provider message",
        }),
      ),
    ).toMatchObject({ statusCode, retryable });
  });
});

function createBuildInput(
  overrides: Partial<
    Parameters<typeof buildBflVideoTaskRequest>[0]["input"]
  > = {},
): Parameters<typeof buildBflVideoTaskRequest>[0] {
  return {
    spec: createBflSpec(),
    input: {
      jobId: "job-1",
      modelId: "flux-3-video",
      modelSpecId: "flux-3-video-v1",
      submittedInput: {
        prompt: "  A glass whale crossing a moonlit harbor  ",
        resolution: "hd",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
      attachmentMedia: [],
      callbackUrl: null,
      ...overrides,
    },
  };
}

function createAttachment(
  fieldId: "images" | "videos" | "audios",
  url: string,
) {
  return {
    fieldId,
    role: "reference" as const,
    url,
    contentType:
      fieldId === "images"
        ? "image/png"
        : fieldId === "videos"
          ? "video/mp4"
          : "audio/mpeg",
    contentLength: 1_024,
  };
}

function createBflSpec(): VideoModelSpec {
  const durations = Array.from({ length: 16 }, (_, index) => index + 5);

  return {
    schemaVersion: 1,
    id: "flux-3-video",
    provider: "bfl",
    providerModelId: "latest",
    displayName: "FLUX 3 Video (Preview)",
    type: "video",
    status: "published",
    sourceUrls: [],
    endpoint: { method: "POST", path: "/v1/flux-3-video" },
    modelParameter: { path: ["version"], source: "spec" },
    fields: [
      createField({ id: "prompt", valueKind: "string" }),
      createField({
        id: "images",
        componentKind: "mediaList",
        valueKind: "array",
        arrayMax: 10,
      }),
      createField({
        id: "videos",
        componentKind: "mediaList",
        valueKind: "array",
        arrayMax: 1,
      }),
      createField({
        id: "resolution",
        valueKind: "string",
        defaultValue: "hd",
        options: ["hd", "fhd"].map((value) => ({ label: value, value })),
      }),
      createField({
        id: "aspectRatio",
        valueKind: "string",
        defaultValue: "auto",
        options: [
          "auto",
          "21:9",
          "2:1",
          "16:9",
          "4:3",
          "1:1",
          "3:4",
          "9:16",
        ].map((value) => ({ label: value, value })),
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        defaultValue: 5,
        options: durations.map((value) => ({ label: `${value}s`, value })),
      }),
      createField({
        id: "generateAudio",
        valueKind: "boolean",
        defaultValue: true,
        options: [
          { label: "On", value: true },
          { label: "Off", value: false },
        ],
      }),
    ],
    groups: [
      {
        id: "generation",
        label: "Generation",
        fieldIds: [
          "prompt",
          "images",
          "videos",
          "resolution",
          "aspectRatio",
          "duration",
          "generateAudio",
        ],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

function createField(
  overrides: Partial<GenerationFieldSpec>,
): GenerationFieldSpec {
  return {
    id: "prompt",
    label: "Field",
    componentKind: "select",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: false,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  } as GenerationFieldSpec;
}
