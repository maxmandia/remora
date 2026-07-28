import { memoryAdapter } from "better-auth/adapters/memory";
import { createEmailVerificationToken } from "better-auth/api";
import { createAuthClient } from "better-auth/client";
import { betterAuth } from "better-auth";
import { describe, expect, it, vi } from "vitest";

import { AuthEmailVerificationService } from "./auth-email-verification.service.ts";
import {
  createAuthEmailVerificationOptions,
  verificationEmailRateLimit,
  verificationEmailTokenLifetimeSeconds,
} from "./auth-email-verification.utils.ts";

const authOrigin = "http://localhost:3000";
const callbackUrl = `${authOrigin}/check-email?verified=true`;
const authSecret = "better-auth-secret-that-is-long-enough-for-validation-test";
const user = {
  email: "guest@example.test",
  name: "Guest",
  password: "password123",
};
const expiredToken = await createEmailVerificationToken(
  authSecret,
  user.email,
  undefined,
  -1,
);

describe("Better Auth guest email verification", () => {
  it("defaults admin access to false and ignores signup input", async () => {
    const harness = createHarness();
    const signupResponse = await harness.fetch(
      `${authOrigin}/api/auth/sign-up/email`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...user,
          isAdmin: true,
        }),
      },
    );

    expect(signupResponse.status).toBe(200);
    expect(
      harness.database.user?.find((candidate) => candidate.email === user.email)
        ?.isAdmin,
    ).toBe(false);

    const sessionResponse = await harness.fetch(
      `${authOrigin}/api/auth/get-session`,
    );
    const session = (await sessionResponse.json()) as {
      user: { isAdmin: boolean };
    };

    expect(session.user.isAdmin).toBe(false);
  });

  it("keeps direct signup and existing unverified sign-in ungated", async () => {
    const harness = createHarness();

    const signup = await harness.client.signUp.email(user);

    expect(signup.error).toBeNull();
    expect(harness.sendVerificationEmail).not.toHaveBeenCalled();

    const signin = await harness.client.signIn.email({
      email: user.email,
      password: user.password,
    });

    expect(signin.error).toBeNull();
    expect(signin.data?.user.emailVerified).toBe(false);
    expect(harness.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("allows manual delivery only after the promotion requires verification", async () => {
    const harness = createHarness();
    await harness.client.signUp.email(user);

    const denied = await harness.client.sendVerificationEmail({
      email: user.email,
      callbackURL: callbackUrl,
    });

    expect(denied.error?.status).toBe(403);
    expect(harness.sendVerificationEmail).not.toHaveBeenCalled();

    harness.status = "verification_required";

    const sent = await harness.client.sendVerificationEmail({
      email: user.email,
      callbackURL: callbackUrl,
    });

    expect(sent.error).toBeNull();
    expect(harness.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it("limits verification delivery to three requests per minute", async () => {
    const harness = createHarness({ enableRateLimit: true });
    harness.status = "verification_required";
    await harness.client.signUp.email(user);

    for (let attempt = 0; attempt < verificationEmailRateLimit.max; attempt++) {
      const result = await harness.client.sendVerificationEmail({
        email: user.email,
        callbackURL: callbackUrl,
      });

      expect(result.error).toBeNull();
    }

    const limited = await harness.client.sendVerificationEmail({
      email: user.email,
      callbackURL: callbackUrl,
    });

    expect(limited.error?.status).toBe(429);
  });

  it("persists verification, refreshes the session, and redirects to the callback", async () => {
    const harness = createHarness();
    harness.status = "verification_required";
    await harness.client.signUp.email(user);
    await harness.client.sendVerificationEmail({
      email: user.email,
      callbackURL: callbackUrl,
    });

    const verificationUrl = harness.sendVerificationEmail.mock.calls[0]?.[0]
      .verificationUrl as string;
    const response = await harness.fetch(verificationUrl, {
      redirect: "manual",
    });
    const persistedUser = harness.database.user?.find(
      (candidate) => candidate.email === user.email,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(callbackUrl);
    expect(response.headers.get("set-cookie")).toContain(
      "better-auth.session_token",
    );
    expect(persistedUser?.emailVerified).toBe(true);
  });

  it.each([
    {
      name: "invalid",
      token: "not-a-token",
      expectedError: "INVALID_TOKEN",
    },
    {
      name: "expired",
      token: expiredToken,
      expectedError: "TOKEN_EXPIRED",
    },
  ])(
    "returns a recoverable callback for an $name token",
    async ({ token, expectedError }) => {
      const harness = createHarness();
      const url = new URL(`${authOrigin}/api/auth/verify-email`);
      url.searchParams.set("token", token);
      url.searchParams.set("callbackURL", callbackUrl);

      const response = await harness.fetch(url, {
        redirect: "manual",
      });
      const location = new URL(response.headers.get("location") ?? "");

      expect(response.status).toBe(302);
      expect(location.origin + location.pathname).toBe(
        `${authOrigin}/check-email`,
      );
      expect(location.searchParams.get("verified")).toBe("true");
      expect(location.searchParams.get("error")).toBe(expectedError);
    },
  );

  it("uses a one-hour verification lifetime", () => {
    expect(verificationEmailTokenLifetimeSeconds).toBe(3_600);
  });
});

function createHarness({
  enableRateLimit = false,
}: {
  enableRateLimit?: boolean;
} = {}) {
  const sendVerificationEmail = vi.fn().mockResolvedValue({
    providerMessageId: "message_1",
    status: "delivered",
  });
  const state = {
    status: "none" as
      | "eligible"
      | "none"
      | "redeemed"
      | "verification_required",
  };
  const service = new AuthEmailVerificationService(
    {
      getStatus: vi.fn(async () => ({ status: state.status })),
      trackEmailVerified: vi.fn().mockResolvedValue(undefined),
    } as never,
    { sendVerificationEmail } as never,
  );
  const verificationOptions = createAuthEmailVerificationOptions({
    callbackUrl,
    service,
  });
  const database: Record<string, Record<string, unknown>[]> = {
    account: [],
    rateLimit: [],
    session: [],
    user: [],
    verification: [],
  };
  const auth = betterAuth({
    ...verificationOptions,
    baseURL: authOrigin,
    database: memoryAdapter(database),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        isAdmin: {
          type: "boolean",
          defaultValue: false,
          input: false,
          required: true,
        },
      },
    },
    rateLimit: {
      ...verificationOptions.rateLimit,
      enabled: enableRateLimit,
    },
    secret: authSecret,
    trustedOrigins: [authOrigin],
  });
  let sessionCookie: string | null = null;
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);

    if (sessionCookie) {
      headers.set("cookie", sessionCookie);
    }

    const response = await auth.handler(
      new Request(input, {
        ...init,
        headers,
      }),
    );
    const setCookie = response.headers.get("set-cookie");
    const matchedSessionCookie = setCookie?.match(
      /(?:^|,\s*)(better-auth\.session_token|__Secure-better-auth\.session_token)=([^;,\s]+)/,
    );

    if (matchedSessionCookie) {
      sessionCookie = `${matchedSessionCookie[1]}=${matchedSessionCookie[2]}`;
    }

    return response;
  };
  const client = createAuthClient({
    baseURL: authOrigin,
    fetchOptions: {
      customFetchImpl: fetch,
    },
  });

  return {
    client,
    database,
    fetch,
    sendVerificationEmail,
    get status() {
      return state.status;
    },
    set status(status: typeof state.status) {
      state.status = status;
    },
  };
}
