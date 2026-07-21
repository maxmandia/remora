import { describe, expect, it } from "vitest";

import type {
  GenerationFieldSpec,
  VideoModelSpec,
} from "../../../model/model.types.ts";
import { ProviderHttpError } from "../provider-http.ts";
import {
  buildKlingVideoTaskRequest,
  KlingPayloadError,
  normalizeKlingVideoTaskResult,
  parseKlingCreateVideoTaskResponse,
} from "./kling.utils.ts";

describe("Kling provider utilities", () => {
  it("maps canonical inputs to an exact Kling 3.0 Pro request", () => {
    expect(
      buildKlingVideoTaskRequest({
        spec: createKlingSpec(),
        input: createKlingInput({
          submittedInput: {
            prompt: "  A silver airship above the sea  ",
            resolution: "1080p",
            aspectRatio: "9:16",
            duration: 8,
            generateAudio: true,
          },
        }),
      }),
    ).toEqual({
      model_name: "kling-v3",
      prompt: "A silver airship above the sea",
      mode: "pro",
      duration: "8",
      aspect_ratio: "9:16",
      sound: "on",
      callback_url:
        "https://backend.example/api/generation-callbacks/kling/job_1?token=test",
      external_task_id: "job_1",
    });
  });

  it.each([
    {
      name: "an empty prompt",
      input: { prompt: "   " },
      message: "requires a prompt",
    },
    {
      name: "a non-Pro resolution",
      input: { resolution: "720p" },
      message: "only supports 1080p",
    },
    {
      name: "an unsupported aspect ratio",
      input: { aspectRatio: "4:3" },
      message: "unsupported aspect ratio",
    },
    {
      name: "a duration below three seconds",
      input: { duration: 2 },
      message: "3 through 15",
    },
  ])("rejects $name", ({ input, message }) => {
    expect(() =>
      buildKlingVideoTaskRequest({
        spec: createKlingSpec(),
        input: createKlingInput({
          submittedInput: {
            ...createKlingInput().submittedInput,
            ...input,
          },
        }),
      }),
    ).toThrow(message);
  });

  it("rejects attachment media", () => {
    expect(() =>
      buildKlingVideoTaskRequest({
        spec: createKlingSpec(),
        input: createKlingInput({
          attachmentMedia: [
            {
              fieldId: "images",
              role: "reference",
              url: "https://assets.example/reference.png",
              contentType: "image/png",
              contentLength: 1_024,
            },
          ],
        }),
      }),
    ).toThrow(KlingPayloadError);
  });

  it("parses successful task creation envelopes", () => {
    expect(
      parseKlingCreateVideoTaskResponse(
        {
          code: 0,
          message: "SUCCEED",
          request_id: "req-1",
          data: { task_id: "task-1" },
        },
        "kling-v3",
      ),
    ).toEqual({
      provider: "kling",
      providerTaskId: "task-1",
      providerModelId: "kling-v3",
    });
  });

  it("rejects nonzero service codes returned with successful HTTP status", () => {
    expect(() =>
      parseKlingCreateVideoTaskResponse(
        {
          code: 1303,
          message: "Concurrency limit exceeded",
          request_id: "req-1",
        },
        "kling-v3",
      ),
    ).toThrowError(
      expect.objectContaining({
        name: "ProviderHttpError",
        code: "1303",
        providerMessage: "Concurrency limit exceeded",
        requestId: "req-1",
      }),
    );
  });

  it.each([
    ["submitted", "queued"],
    ["processing", "running"],
    ["succeed", "succeeded"],
    ["failed", "failed"],
  ] as const)("normalizes %s callbacks to %s", (taskStatus, status) => {
    expect(
      normalizeKlingVideoTaskResult(
        createCallback({ task_status: taskStatus }),
        "kling-v3",
      ),
    ).toMatchObject({
      provider: "kling",
      providerTaskId: "task-1",
      providerModelId: "kling-v3",
      status,
      usage: null,
      createdAt: 1_780_770_000,
      updatedAt: 1_780_770_060,
    });
  });

  it("uses the provider task message for failed callbacks", () => {
    expect(
      normalizeKlingVideoTaskResult(
        createCallback({
          task_status: "failed",
          task_status_msg: "Prompt violated provider policy",
        }),
        "kling-v3",
      ),
    ).toMatchObject({
      status: "failed",
      videoUrl: null,
      providerError: {
        code: null,
        message: "Prompt violated provider policy",
      },
    });
  });

  it("extracts the first successful video URL", () => {
    expect(
      normalizeKlingVideoTaskResult(createCallback(), "kling-v3"),
    ).toMatchObject({
      status: "succeeded",
      videoUrl: "https://assets.example/result.mp4",
      providerError: null,
    });
  });

  it("rejects successful callbacks without a usable video URL", () => {
    expect(() =>
      normalizeKlingVideoTaskResult(
        createCallback({ task_result: { videos: [] } }),
        "kling-v3",
      ),
    ).toThrow(ProviderHttpError);
  });

  it.each([
    null,
    {},
    { task_id: "task-1", task_status: "unknown" },
    { task_id: "", task_status: "processing" },
  ])("rejects malformed callbacks", (payload) => {
    expect(() => normalizeKlingVideoTaskResult(payload, "kling-v3")).toThrow(
      ProviderHttpError,
    );
  });
});

function createKlingInput(
  overrides: Partial<
    Parameters<typeof buildKlingVideoTaskRequest>[0]["input"]
  > = {},
): Parameters<typeof buildKlingVideoTaskRequest>[0]["input"] {
  return {
    jobId: "job_1",
    modelId: "kling-v3-text-to-video",
    modelSpecId: "kling-v3-text-to-video-v2",
    submittedInput: {
      prompt: "A silver airship above the sea",
      resolution: "1080p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: false,
    },
    attachmentMedia: [],
    callbackUrl:
      "https://backend.example/api/generation-callbacks/kling/job_1?token=test",
    ...overrides,
  };
}

function createCallback(overrides: Record<string, unknown> = {}) {
  return {
    task_id: "task-1",
    task_status: "succeed",
    task_status_msg: "",
    created_at: 1_780_770_000,
    updated_at: 1_780_770_060,
    task_result: {
      videos: [{ url: "https://assets.example/result.mp4" }],
    },
    final_balance_deduction: 0.56,
    ...overrides,
  };
}

function createKlingSpec(): VideoModelSpec {
  const durations = Array.from({ length: 13 }, (_, index) => index + 3);

  return {
    schemaVersion: 1,
    id: "kling-v3-text-to-video-v2",
    provider: "kling",
    providerModelId: "kling-v3",
    displayName: "Kling 3.0 1080p (Pro)",
    type: "video",
    status: "published",
    sourceUrls: [],
    endpoint: {
      method: "POST",
      path: "/v1/videos/text2video",
    },
    modelParameter: {
      path: ["model_name"],
      source: "spec",
    },
    fields: [
      createField({
        id: "prompt",
        componentKind: "promptTextarea",
        valueKind: "string",
        required: true,
        maxLength: 2_500,
        defaultValue: "",
        providerPath: ["prompt"],
      }),
      createField({
        id: "resolution",
        componentKind: "hidden",
        valueKind: "string",
        defaultValue: "1080p",
        providerPath: ["mode"],
        options: [{ label: "1080p", value: "1080p" }],
        providerValueMap: [{ canonicalValue: "1080p", providerValue: "pro" }],
      }),
      createField({
        id: "aspectRatio",
        valueKind: "string",
        defaultValue: "16:9",
        providerPath: ["aspect_ratio"],
        options: ["16:9", "9:16", "1:1"].map((value) => ({
          label: value,
          value,
        })),
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        min: 3,
        max: 15,
        defaultValue: 5,
        providerPath: ["duration"],
        options: durations.map((value) => ({
          label: `${value}s`,
          value,
        })),
        providerValueMap: durations.map((value) => ({
          canonicalValue: value,
          providerValue: String(value),
        })),
      }),
      createField({
        id: "generateAudio",
        valueKind: "boolean",
        defaultValue: false,
        providerPath: ["sound"],
        options: [
          { label: "Off", value: false },
          { label: "On", value: true },
        ],
        providerValueMap: [
          { canonicalValue: false, providerValue: "off" },
          { canonicalValue: true, providerValue: "on" },
        ],
      }),
      createField({
        id: "callbackUrl",
        componentKind: "hidden",
        valueKind: "string",
        defaultValue: "",
        providerPath: ["callback_url"],
      }),
    ],
    groups: [
      {
        id: "output",
        label: "Output",
        fieldIds: [
          "prompt",
          "resolution",
          "aspectRatio",
          "duration",
          "generateAudio",
          "callbackUrl",
        ],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

function createField(overrides: Partial<GenerationFieldSpec>): GenerationFieldSpec {
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
