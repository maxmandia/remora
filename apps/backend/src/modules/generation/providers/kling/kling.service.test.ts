import { describe, expect, it, vi } from "vitest";

import type {
  VideoFieldSpec,
  VideoModelSpec,
} from "../../../model/model.types.ts";
import { ProviderHttpError } from "../provider-http.ts";
import { KlingService } from "./kling.service.ts";

describe("KlingService", () => {
  it("creates Kling video tasks with API-key bearer authentication", async () => {
    const fetcher = createFetchMock({
      code: 0,
      message: "SUCCEED",
      request_id: "req-1",
      data: { task_id: "task-1" },
    });
    const service = createService(fetcher);

    await expect(
      service.createVideoTask({
        spec: createKlingSpec(),
        input: createKlingInput(),
      }),
    ).resolves.toEqual({
      provider: "kling",
      providerTaskId: "task-1",
      providerModelId: "kling-v3",
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      "https://api-singapore.klingai.com/v1/videos/text2video",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer kling-test-key",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model_name: "kling-v3",
      prompt: "A calm sea at sunrise",
      mode: "pro",
      duration: "5",
      aspect_ratio: "16:9",
      sound: "off",
      callback_url:
        "https://backend.example/api/generation-callbacks/kling/job_1?token=test",
      external_task_id: "job_1",
    });
  });

  it("preserves numeric Kling errors returned by non-2xx responses", async () => {
    const service = createService(
      createFetchMock(
        {
          code: 1002,
          message: "Invalid API key",
          request_id: "req-auth",
        },
        401,
      ),
    );

    await expect(
      service.createVideoTask({
        spec: createKlingSpec(),
        input: createKlingInput(),
      }),
    ).rejects.toMatchObject({
      name: "ProviderHttpError",
      statusCode: 401,
      code: "1002",
      providerMessage: "Invalid API key",
      requestId: "req-auth",
    });
  });

  it("rejects malformed JSON responses", async () => {
    const fetcher = vi.fn(
      async () => new Response("not-json"),
    ) as unknown as FetchMock;
    const service = createService(fetcher);

    await expect(
      service.createVideoTask({
        spec: createKlingSpec(),
        input: createKlingInput(),
      }),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it("propagates network failures without retrying task creation", async () => {
    const networkError = new TypeError("network unavailable");
    const fetcher = vi.fn(async () => {
      throw networkError;
    }) as unknown as FetchMock;
    const service = createService(fetcher);

    await expect(
      service.createVideoTask({
        spec: createKlingSpec(),
        input: createKlingInput(),
      }),
    ).rejects.toBe(networkError);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("normalizes callbacks without reading provider configuration", () => {
    const service = new KlingService({
      environment: {},
      fetcher: createFetchMock({}),
    });

    expect(
      service.normalizeVideoTaskResult(
        {
          task_id: "task-1",
          task_status: "processing",
          task_status_msg: "",
          created_at: 1_780_770_000,
          updated_at: 1_780_770_060,
        },
        "kling-v3",
      ),
    ).toMatchObject({
      provider: "kling",
      providerTaskId: "task-1",
      providerModelId: "kling-v3",
      status: "running",
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
  return new KlingService({
    environment: {
      KLING_API_KEY: "kling-test-key",
      KLING_API_BASE_URL: "https://api-singapore.klingai.com",
    },
    fetcher,
  });
}

function createKlingInput() {
  return {
    jobId: "job_1",
    modelId: "kling-v3-text-to-video",
    modelSpecId: "kling-v3-text-to-video-v2",
    submittedInput: {
      prompt: "A calm sea at sunrise",
      resolution: "1080p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: false,
    },
    attachmentMedia: [],
    callbackUrl:
      "https://backend.example/api/generation-callbacks/kling/job_1?token=test",
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
    endpoint: { method: "POST", path: "/v1/videos/text2video" },
    modelParameter: { path: ["model_name"], source: "spec" },
    fields: [
      createField({
        id: "prompt",
        valueKind: "string",
        required: true,
        maxLength: 2_500,
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

function createField(overrides: Partial<VideoFieldSpec>): VideoFieldSpec {
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
  } as VideoFieldSpec;
}
