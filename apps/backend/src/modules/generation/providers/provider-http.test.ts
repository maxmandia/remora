import { describe, expect, it, vi } from "vitest";

import { requestProviderJson } from "./provider-http.ts";

describe("requestProviderJson", () => {
  it("joins base URLs and paths with or without trailing slashes", async () => {
    const fetcher = createFetchMock({ ok: true });

    await requestProviderJson({
      providerName: "TestProvider",
      baseUrl: "https://provider.example/api/v1",
      path: "/tasks",
      fetcher,
      init: { method: "GET" },
    });
    await requestProviderJson({
      providerName: "TestProvider",
      baseUrl: "https://provider.example/api/v1/",
      path: "tasks/123",
      fetcher,
      init: { method: "GET" },
    });

    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      "https://provider.example/api/v1/tasks",
    );
    expect(String(fetcher.mock.calls[1]?.[0])).toBe(
      "https://provider.example/api/v1/tasks/123",
    );
  });

  it("parses JSON success responses and applies JSON content type", async () => {
    const fetcher = createFetchMock({ taskId: "provider-task" });

    await expect(
      requestProviderJson({
        providerName: "TestProvider",
        baseUrl: "https://provider.example/api/v1",
        path: "tasks",
        fetcher,
        init: {
          method: "POST",
          body: JSON.stringify({ prompt: "hello" }),
        },
      }),
    ).resolves.toEqual({ taskId: "provider-task" });

    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("extracts nested error code and message from non-2xx responses", async () => {
    const fetcher = createFetchMock(
      {
        error: {
          code: "Unauthorized",
          message: "Bad API key",
          rawSecret: "hidden",
        },
      },
      401,
    );

    await expect(
      requestProviderJson({
        providerName: "TestProvider",
        baseUrl: "https://provider.example/api/v1",
        path: "tasks",
        fetcher,
        init: { method: "GET" },
      }),
    ).rejects.toMatchObject({
      name: "ProviderHttpError",
      message:
        "TestProvider request failed: Bad API key (HTTP 401, code Unauthorized)",
      statusCode: 401,
      code: "Unauthorized",
      providerMessage: "Bad API key",
    });
  });

  it("extracts top-level error code and message from non-2xx responses", async () => {
    const fetcher = createFetchMock(
      {
        code: "InvalidRequest",
        message: "Missing prompt",
      },
      400,
    );

    await expect(
      requestProviderJson({
        providerName: "TestProvider",
        baseUrl: "https://provider.example/api/v1",
        path: "tasks",
        fetcher,
        init: { method: "POST" },
      }),
    ).rejects.toMatchObject({
      name: "ProviderHttpError",
      message:
        "TestProvider request failed: Missing prompt (HTTP 400, code InvalidRequest)",
      statusCode: 400,
      code: "InvalidRequest",
      providerMessage: "Missing prompt",
    });
  });

  it("preserves numeric error codes and provider request ids", async () => {
    const fetcher = createFetchMock(
      {
        code: 1303,
        message: "Concurrency limit exceeded",
        request_id: "req-kling-1",
      },
      429,
    );

    await expect(
      requestProviderJson({
        providerName: "Kling",
        baseUrl: "https://provider.example",
        path: "/tasks",
        fetcher,
        init: { method: "POST" },
      }),
    ).rejects.toMatchObject({
      name: "ProviderHttpError",
      message:
        "Kling request failed: Concurrency limit exceeded (HTTP 429, code 1303, request req-kling-1)",
      statusCode: 429,
      code: "1303",
      providerMessage: "Concurrency limit exceeded",
      requestId: "req-kling-1",
    });
  });

  it("rejects malformed JSON responses", async () => {
    const fetcher = vi.fn(
      async () => new Response("not json"),
    ) as unknown as FetchMock;

    await expect(
      requestProviderJson({
        providerName: "TestProvider",
        baseUrl: "https://provider.example/api/v1",
        path: "tasks",
        fetcher,
        init: { method: "GET" },
      }),
    ).rejects.toMatchObject({
      name: "ProviderHttpError",
      message: "TestProvider response was not valid JSON",
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
        headers: {
          "Content-Type": "application/json",
        },
      }),
  ) as unknown as FetchMock;
}
