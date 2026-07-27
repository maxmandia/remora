import { describe, expect, it, vi } from "vitest";

import {
  VerificationEmailConfigurationError,
  VerificationEmailDeliveryError,
  type VerificationEmailMessage,
} from "../../email.types.ts";
import { CloudflareVerificationEmailProvider } from "./cloudflare-email.service.ts";

const config = {
  CLOUDFLARE_EMAIL_ACCOUNT_ID: "account/id",
  CLOUDFLARE_EMAIL_API_TOKEN: "api-token-secret",
  CLOUDFLARE_EMAIL_SENDER_ADDRESS: "verify@remora.computer",
  CLOUDFLARE_EMAIL_SENDER_NAME: "Remora",
};
const message: VerificationEmailMessage = {
  to: "user@example.test",
  subject: "Verify",
  html: '<a href="https://api.example.test/verify?token=secret">Verify</a>',
  text: "https://api.example.test/verify?token=secret",
};

describe("Cloudflare verification email provider", () => {
  it.each([
    {
      result: {
        delivered: ["user@example.test"],
        queued: [],
        permanent_bounces: [],
        message_id: "message_1",
      },
      expected: {
        providerMessageId: "message_1",
        status: "delivered",
      },
    },
    {
      result: {
        delivered: [],
        queued: ["user@example.test"],
        permanent_bounces: [],
      },
      expected: {
        providerMessageId: null,
        status: "queued",
      },
    },
  ])("accepts delivered and queued responses", async ({ result, expected }) => {
    const fetcher = createFetchMock({
      success: true,
      result,
    });
    const createTimeoutSignal = vi.fn(() => new AbortController().signal);
    const provider = createProvider({ fetcher, createTimeoutSignal });

    await expect(provider.deliver(message)).resolves.toEqual(expected);
    expect(createTimeoutSignal).toHaveBeenCalledWith(5_000);
    const [url, init] = fetcher.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account%2Fid/email/sending/send",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer api-token-secret",
        "Content-Type": "application/json",
      },
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      to: "user@example.test",
      from: {
        address: "verify@remora.computer",
        name: "Remora",
      },
      subject: "Verify",
      html: message.html,
      text: message.text,
    });
  });

  it("rejects permanent bounces", async () => {
    const provider = createProvider({
      fetcher: createFetchMock({
        success: true,
        result: {
          delivered: [],
          queued: [],
          permanent_bounces: ["user@example.test"],
        },
      }),
    });

    await expect(provider.deliver(message)).rejects.toMatchObject({
      kind: "permanent-bounce",
      message: "Verification email delivery failed.",
    });
  });

  it.each([
    {
      name: "non-success HTTP responses",
      fetcher: vi.fn(async () => new Response(null, { status: 429 })),
      expected: { kind: "provider-error", statusCode: 429 },
    },
    {
      name: "provider error envelopes",
      fetcher: createFetchMock({ success: false, result: null }),
      expected: { kind: "provider-error", statusCode: null },
    },
    {
      name: "malformed responses",
      fetcher: vi.fn(
        async () =>
          new Response('{"success":true,"result":{}}', {
            headers: { "Content-Type": "application/json" },
          }),
      ),
      expected: { kind: "invalid-response", statusCode: null },
    },
    {
      name: "timeouts",
      fetcher: vi.fn(async () => {
        throw new DOMException("timed out", "TimeoutError");
      }),
      expected: { kind: "timeout", statusCode: null },
    },
  ])("returns sanitized $name", async ({ fetcher, expected }) => {
    const provider = createProvider({ fetcher: fetcher as typeof fetch });

    let error: unknown;

    try {
      await provider.deliver(message);
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(VerificationEmailDeliveryError);
    expect(error).toMatchObject(expected);
    expect(String(error)).not.toContain("secret");
    expect(JSON.stringify(error)).not.toContain("secret");
  });

  it("rejects missing configuration without invoking Cloudflare", async () => {
    const fetcher = vi.fn();
    const provider = createProvider({
      fetcher: fetcher as unknown as typeof fetch,
      getConfig: () => ({
        ...config,
        CLOUDFLARE_EMAIL_API_TOKEN: null,
      }),
    });

    await expect(provider.deliver(message)).rejects.toBeInstanceOf(
      VerificationEmailConfigurationError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});

function createFetchMock(payload: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch & {
    mock: { calls: Parameters<typeof fetch>[] };
  };
}

function createProvider(
  dependencies: Partial<
    ConstructorParameters<typeof CloudflareVerificationEmailProvider>[0]
  > = {},
) {
  return new CloudflareVerificationEmailProvider({
    createTimeoutSignal: () => new AbortController().signal,
    getConfig: () => config,
    ...dependencies,
  });
}
