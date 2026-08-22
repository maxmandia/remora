import { describe, expect, it, vi } from "vitest";

import type { Model3dModelSpec } from "../../../model/model.types.ts";
import type { CreateModel3dTaskInput } from "../../generation.types.ts";
import { TripoService } from "./tripo.service.ts";

describe("TripoService", () => {
  it("creates text-to-3D tasks using bearer authentication", async () => {
    const fetcher = createFetchMock({ code: 0, data: { task_id: "task-1" } });
    const service = createService(fetcher);

    await expect(
      service.createModel3dTask({
        spec: createSpec("/generation/text-to-model"),
        input: createInput(),
      }),
    ).resolves.toMatchObject({ providerTaskId: "task-1" });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://openapi.tripo3d.ai/v3/generation/text-to-model",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer tripo-test-key",
        "Content-Type": "application/json",
      },
    });
  });

  it("retrieves task status from the task endpoint", async () => {
    const fetcher = createFetchMock({
      code: 0,
      data: { task_id: "task-1", status: "running" },
    });
    const service = createService(fetcher);

    await service.retrieveModel3dTask("task-1");

    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      "https://openapi.tripo3d.ai/v3/tasks/task-1",
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
  });

  it.each([429, 500, 503])(
    "classifies HTTP %s as retryable and preserves Retry-After",
    async (status) => {
      const service = createService(
        createFetchMock(
          { code: 2000, message: "Try again", request_id: "req-1" },
          status,
          { "Retry-After": "3" },
        ),
      );

      await expect(service.retrieveModel3dTask("task-1")).rejects.toMatchObject({
        name: "TripoProviderError",
        code: "2000",
        providerMessage: "Try again",
        retryable: true,
        retryAfterMs: 3_000,
        statusCode: status,
        requestId: "req-1",
      });
    },
  );

  it("classifies client errors as permanent", async () => {
    const service = createService(
      createFetchMock({ code: 1002, message: "Invalid key" }, 401),
    );

    await expect(service.retrieveModel3dTask("task-1")).rejects.toMatchObject({
      retryable: false,
      statusCode: 401,
      code: "1002",
    });
  });

  it("classifies network failures as retryable", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("network unavailable");
    }) as unknown as FetchMock;

    await expect(
      createService(fetcher).retrieveModel3dTask("task-1"),
    ).rejects.toMatchObject({
      retryable: true,
      statusCode: null,
      message: "network unavailable",
    });
  });

  it("rejects task IDs that could escape the task path", async () => {
    const fetcher = createFetchMock({});
    await expect(
      createService(fetcher).retrieveModel3dTask("../task-1"),
    ).rejects.toMatchObject({ retryable: false, code: "INVALID_TASK_ID" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

type FetchMock = typeof fetch & {
  mock: { calls: Parameters<typeof fetch>[] };
};

function createFetchMock(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): FetchMock {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
      }),
  ) as unknown as FetchMock;
}

function createService(fetcher: FetchMock) {
  return new TripoService({
    environment: {
      TRIPO_API_KEY: "tripo-test-key",
      TRIPO_API_BASE_URL: "https://openapi.tripo3d.ai/v3",
    },
    fetcher,
  });
}

function createInput(): CreateModel3dTaskInput {
  return {
    jobId: "job-1",
    modelId: "tripo-h3-1-text-to-3d",
    modelSpecId: "tripo-h3-1-text-to-3d-v1",
    submittedInput: {
      prompt: "A ceramic fox",
      textureLevel: "standard",
      faceLimit: null,
      geometryQuality: "standard",
    },
    attachmentMedia: [],
  };
}

function createSpec(path: Model3dModelSpec["endpoint"]["path"]): Model3dModelSpec {
  return {
    schemaVersion: 1,
    id: "tripo-h3-1-text-to-3d-v1",
    provider: "tripo",
    providerModelId: "v3.1-20260211",
    displayName: "Tripo H3.1 Text to 3D",
    type: "model3d",
    status: "published",
    sourceUrls: [],
    endpoint: { method: "POST", path },
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
        maxLength: 1_024,
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
