import { describe, expect, it, vi } from "vitest";

import type { VideoModelSpec } from "../../../model/model.types.ts";
import { BflService } from "./bfl.service.ts";

describe("BflService", () => {
  it("creates FLUX 3 tasks with x-key authentication", async () => {
    const fetcher = createFetchMock({
      id: "task-1",
      polling_url: "https://api.bfl.ai/v1/get_result?id=task-1",
    });
    const service = createService(fetcher);

    await expect(
      service.createVideoTask({ spec: createSpec(), input: createInput() }),
    ).resolves.toEqual({
      provider: "bfl",
      providerTaskId: "task-1",
      providerModelId: "latest",
      pollingUrl: "https://api.bfl.ai/v1/get_result?id=task-1",
    });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.bfl.ai/v1/flux-3-video");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-key": "bfl-test-key",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: "A calm sea at sunrise",
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

  it("polls the exact provider URL with credentials after validation", async () => {
    const fetcher = createFetchMock({ id: "task-1", status: "Pending" });
    const service = createService(fetcher);

    await expect(
      service.retrieveVideoTask(
        "https://api.us.bfl.ai/v1/get_result?id=task-1&full=true",
      ),
    ).resolves.toEqual({ id: "task-1", status: "Pending" });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://api.us.bfl.ai/v1/get_result?id=task-1&full=true",
    );
    expect(init).toMatchObject({
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-key": "bfl-test-key",
      },
    });
  });

  it("does not send credentials to an unapproved polling host", async () => {
    const fetcher = createFetchMock({});
    const service = createService(fetcher);

    await expect(
      service.retrieveVideoTask(
        "https://attacker.example/v1/get_result?id=task-1",
      ),
    ).rejects.toThrow("host was not allowed");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, false],
    [422, false],
    [429, true],
    [503, true],
  ])(
    "classifies polling HTTP %s responses with retryable=%s",
    async (status, retryable) => {
      const service = createService(
        createFetchMock({ error: { message: "provider error" } }, status),
      );

      await expect(
        service.retrieveVideoTask("https://api.bfl.ai/v1/get_result?id=task-1"),
      ).rejects.toMatchObject({ statusCode: status, retryable });
    },
  );
});

type FetchMock = typeof fetch & {
  mock: { calls: Parameters<typeof fetch>[] };
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
  return new BflService({
    environment: {
      BFL_API_KEY: "bfl-test-key",
      BFL_API_BASE_URL: "https://api.bfl.ai",
    },
    fetcher,
  });
}

function createInput() {
  return {
    jobId: "job-1",
    modelId: "flux-3-video",
    modelSpecId: "flux-3-video-v1",
    submittedInput: {
      prompt: "A calm sea at sunrise",
      resolution: "hd",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    attachmentMedia: [],
    callbackUrl: null,
  };
}

function createSpec(): VideoModelSpec {
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
        id: "generation",
        label: "Generation",
        fieldIds: ["prompt"],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}
