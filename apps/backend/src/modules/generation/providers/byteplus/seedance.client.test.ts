import { describe, expect, it, vi } from "vitest";

import { ProviderHttpError } from "../provider-http.ts";
import { BytePlusSeedanceClient } from "./seedance.client.ts";

describe("BytePlusSeedanceClient", () => {
  it("creates Seedance video tasks with bearer auth and JSON payloads", async () => {
    const fetcher = createFetchMock({
      id: "cgt-123",
    });
    const client = new BytePlusSeedanceClient({
      apiKey: "ark-test-key",
      baseUrl: "https://ark.example.test/api/v3",
      fetcher,
    });

    await expect(
      client.createSeedanceVideoTask({
        model: "dreamina-seedance-2-0-260128",
        content: [{ type: "text", text: "A clean product shot" }],
      }),
    ).resolves.toEqual({
      provider: "byteplus",
      providerTaskId: "cgt-123",
      providerModelId: "dreamina-seedance-2-0-260128",
    });

    expect(fetcher).toHaveBeenCalledOnce();

    const [url, init] = fetcher.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      "https://ark.example.test/api/v3/contents/generations/tasks",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ark-test-key",
      },
      body: JSON.stringify({
        model: "dreamina-seedance-2-0-260128",
        content: [{ type: "text", text: "A clean product shot" }],
      }),
    });
  });

  it("retrieves and normalizes succeeded Seedance task responses", async () => {
    const fetcher = createFetchMock({
      id: "cgt-123",
      model: "dreamina-seedance-2-0-260128",
      status: "succeeded",
      content: {
        video_url: "https://assets.example/video.mp4",
        last_frame_url: "https://assets.example/last-frame.png",
      },
      usage: {
        completion_tokens: 108900,
        total_tokens: 108900,
      },
      created_at: 1743414619,
      updated_at: 1743414673,
    });
    const client = new BytePlusSeedanceClient({
      apiKey: "ark-test-key",
      baseUrl: "https://ark.example.test/api/v3/",
      fetcher,
    });

    await expect(client.retrieveSeedanceVideoTask("cgt-123")).resolves.toEqual({
      provider: "byteplus",
      providerTaskId: "cgt-123",
      providerModelId: "dreamina-seedance-2-0-260128",
      status: "succeeded",
      videoUrl: "https://assets.example/video.mp4",
      usage: {
        completionTokens: 108900,
        totalTokens: 108900,
      },
      createdAt: 1743414619,
      updatedAt: 1743414673,
      providerError: null,
    });

    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      "https://ark.example.test/api/v3/contents/generations/tasks/cgt-123",
    );
  });

  it("retrieves and normalizes failed task responses", async () => {
    const fetcher = createFetchMock({
      id: "cgt-123",
      status: "failed",
      error: {
        code: "InvalidParameter",
        message: "Unsupported reference input",
      },
    });
    const client = new BytePlusSeedanceClient({
      apiKey: "ark-test-key",
      baseUrl: "https://ark.example.test/api/v3",
      fetcher,
    });

    await expect(
      client.retrieveSeedanceVideoTask("cgt-123"),
    ).resolves.toMatchObject({
      providerTaskId: "cgt-123",
      providerModelId: null,
      status: "failed",
      videoUrl: null,
      providerError: {
        code: "InvalidParameter",
        message: "Unsupported reference input",
      },
    });
  });

  it("normalizes HTTP errors without exposing raw response bodies", async () => {
    const fetcher = createFetchMock(
      {
        error: {
          code: "Unauthorized",
          message: "Bad API key",
          raw_secret: "do-not-expose",
        },
      },
      401,
    );
    const client = new BytePlusSeedanceClient({
      apiKey: "ark-test-key",
      baseUrl: "https://ark.example.test/api/v3",
      fetcher,
    });

    await expect(
      client.retrieveSeedanceVideoTask("cgt-123"),
    ).rejects.toMatchObject({
      name: "ProviderHttpError",
      statusCode: 401,
      code: "Unauthorized",
      providerMessage: "Bad API key",
    });
  });

  it("rejects malformed JSON responses", async () => {
    const fetcher = vi.fn(
      async () => new Response("not json"),
    ) as unknown as FetchMock;
    const client = new BytePlusSeedanceClient({
      apiKey: "ark-test-key",
      baseUrl: "https://ark.example.test/api/v3",
      fetcher,
    });

    await expect(
      client.retrieveSeedanceVideoTask("cgt-123"),
    ).rejects.toBeInstanceOf(ProviderHttpError);
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
        headers: {
          "Content-Type": "application/json",
        },
      }),
  ) as unknown as FetchMock;
}
