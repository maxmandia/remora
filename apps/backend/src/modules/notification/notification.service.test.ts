import { describe, expect, it, vi } from "vitest";

import { NotificationService } from "./notification.service.ts";

const webhookUrl = "https://discord.com/api/webhooks/1234567890/webhook-token";
const occurredAt = new Date("2026-07-15T14:30:00.000Z");

describe("notification service", () => {
  it("does not deliver when signup notifications are disabled", () => {
    const fetcher = vi.fn();
    const service = createService({
      fetcher,
      getConfig: () => ({ DISCORD_SIGNUP_WEBHOOK_URL: null }),
    });

    service.initialize();
    service.notifyAccountSignedUp(createNotification());

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts the complete signup identity without allowing mentions", async () => {
    const fetcher = createFetchMock(new Response(null, { status: 204 }));
    const createTimeoutSignal = vi.fn(() => new AbortController().signal);
    const service = createService({ fetcher, createTimeoutSignal });

    service.initialize();
    service.notifyAccountSignedUp(
      createNotification({
        name: "Max *Remora*",
        email: "max_test@example.com",
      }),
    );

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const [url, init] = fetcher.mock.calls[0] ?? [];

    expect(String(url)).toBe(`${webhookUrl}?wait=true`);
    expect(createTimeoutSignal).toHaveBeenCalledWith(3_000);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      username: "Remora Notifications",
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: "New Remora signup",
          fields: [
            { name: "Name", value: "Max \\*Remora\\*", inline: true },
            {
              name: "Email",
              value: "max\\_test@example\\.com",
              inline: true,
            },
            { name: "User ID", value: "user\\_1", inline: false },
          ],
          timestamp: occurredAt.toISOString(),
        },
      ],
    });
  });

  it("renders a missing name explicitly", async () => {
    const fetcher = createFetchMock(new Response(null, { status: 204 }));
    const service = createService({ fetcher });

    service.initialize();
    service.notifyAccountSignedUp(createNotification({ name: null }));

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const [, init] = fetcher.mock.calls[0] ?? [];
    const payload = JSON.parse(String(init?.body));

    expect(payload.embeds[0].fields[0].value).toBe("Not provided");
  });

  it("returns without waiting for Discord", () => {
    const fetcher = vi.fn(
      () => new Promise<Response>(() => {}),
    ) as unknown as FetchMock;
    const service = createService({ fetcher });

    service.initialize();

    expect(service.notifyAccountSignedUp(createNotification())).toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: "network failures",
      fetcher: () => Promise.reject(new TypeError("network unavailable")),
    },
    {
      name: "timeouts",
      fetcher: () =>
        Promise.reject(new DOMException("timed out", "TimeoutError")),
    },
    {
      name: "non-success responses",
      fetcher: () => Promise.resolve(new Response(null, { status: 429 })),
    },
  ])("contains $name without retrying", async ({ fetcher: fetchResponse }) => {
    const fetcher = vi.fn(fetchResponse) as unknown as FetchMock;
    const reportError = vi.fn();
    const service = createService({ fetcher, reportError });

    service.initialize();
    expect(() =>
      service.notifyAccountSignedUp(createNotification()),
    ).not.toThrow();

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith("delivery", expect.anything(), {
      userId: "user_1",
    });
  });

  it("contains configuration failures and remains disabled", () => {
    const configError = new Error("missing webhook");
    const fetcher = vi.fn();
    const reportError = vi.fn();
    const service = createService({
      fetcher,
      getConfig: () => {
        throw configError;
      },
      reportError,
    });

    expect(() => service.initialize()).not.toThrow();
    service.notifyAccountSignedUp(createNotification());

    expect(reportError).toHaveBeenCalledWith(
      "initialization",
      configError,
      undefined,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("contains failures from notification error reporting", async () => {
    const service = createService({
      fetcher: vi.fn(() => Promise.reject(new Error("network unavailable"))),
      reportError: () => {
        throw new Error("reporting unavailable");
      },
    });

    service.initialize();

    expect(() =>
      service.notifyAccountSignedUp(createNotification()),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

type FetchMock = typeof fetch & {
  mock: {
    calls: Parameters<typeof fetch>[];
  };
};

function createFetchMock(response: Response): FetchMock {
  return vi.fn(async () => response) as unknown as FetchMock;
}

function createService(
  dependencies: Partial<
    ConstructorParameters<typeof NotificationService>[0]
  > = {},
) {
  return new NotificationService({
    createTimeoutSignal: () => new AbortController().signal,
    fetcher: createFetchMock(new Response(null, { status: 204 })),
    getConfig: () => ({ DISCORD_SIGNUP_WEBHOOK_URL: webhookUrl }),
    reportError: vi.fn(),
    ...dependencies,
  });
}

function createNotification(
  overrides: Partial<
    Parameters<NotificationService["notifyAccountSignedUp"]>[0]
  > = {},
) {
  return {
    userId: "user_1",
    email: "user@example.com",
    name: "User",
    occurredAt,
    ...overrides,
  };
}
