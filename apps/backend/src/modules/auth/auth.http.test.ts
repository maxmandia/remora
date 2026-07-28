import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionFromHeaders: vi.fn(),
  handler: vi.fn(),
  logImpersonationTransition: vi.fn(),
}));

vi.mock("./auth.ts", () => ({
  auth: {
    handler: mocks.handler,
  },
  getSessionFromHeaders: mocks.getSessionFromHeaders,
}));

vi.mock("./auth.observability.ts", () => ({
  logImpersonationTransition: mocks.logImpersonationTransition,
}));

import { handleAuthRequest } from "./auth.http.ts";

describe("handleAuthRequest", () => {
  beforeEach(() => {
    mocks.getSessionFromHeaders.mockReset();
    mocks.getSessionFromHeaders.mockResolvedValue(null);
    mocks.handler.mockReset();
    mocks.logImpersonationTransition.mockReset();
  });

  it("forwards every Better Auth Set-Cookie header", async () => {
    const headers = new Headers();
    headers.append(
      "set-cookie",
      "better-auth.admin_session=restore; Path=/; HttpOnly",
    );
    headers.append(
      "set-cookie",
      "better-auth.session_token=effective; Path=/; HttpOnly",
    );
    mocks.handler.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers,
      }),
    );
    const header = vi.fn();
    const send = vi.fn((value) => value);
    const status = vi.fn(() => ({ header, send, status }));
    const request = {
      body: { userId: "user_1" },
      headers: { host: "localhost:3001" },
      id: "request_1",
      log: {
        error: vi.fn(),
      },
      method: "POST",
      url: "/api/auth/admin/impersonate-user",
    };
    const reply = { header, send, status };

    await handleAuthRequest(request as never, reply as never, 3001);

    expect(header).toHaveBeenCalledWith("set-cookie", [
      "better-auth.admin_session=restore; Path=/; HttpOnly",
      "better-auth.session_token=effective; Path=/; HttpOnly",
    ]);
  });

  it("delegates impersonation start logging to auth observability", async () => {
    const session = {
      session: {
        id: "session_admin",
        impersonatedBy: null,
      },
      user: {
        id: "admin_1",
      },
    };
    mocks.getSessionFromHeaders.mockResolvedValue(session);
    mocks.handler.mockResolvedValue(
      new Response(
        JSON.stringify({
          session: { id: "session_impersonated" },
          user: { id: "user_1" },
        }),
        {
          status: 200,
        },
      ),
    );
    const header = vi.fn();
    const send = vi.fn((value) => value);
    const status = vi.fn(() => ({ header, send, status }));
    const request = {
      body: { userId: "user_1" },
      headers: { host: "localhost:3001" },
      id: "request_1",
      log: {
        error: vi.fn(),
      },
      method: "POST",
      url: "/api/auth/admin/impersonate-user",
    };
    const reply = { header, send, status };

    await handleAuthRequest(request as never, reply as never, 3001);

    expect(mocks.logImpersonationTransition).toHaveBeenCalledWith({
      requestBody: { userId: "user_1" },
      requestId: "request_1",
      requestUrl: "/api/auth/admin/impersonate-user",
      response: expect.any(Response),
      session,
    });
  });

  it("delegates impersonation stop logging to auth observability", async () => {
    const session = {
      session: {
        id: "session_1",
        impersonatedBy: "admin_1",
      },
      user: {
        id: "user_1",
      },
    };
    mocks.getSessionFromHeaders.mockResolvedValue(session);
    mocks.handler.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      }),
    );
    const header = vi.fn();
    const send = vi.fn((value) => value);
    const status = vi.fn(() => ({ header, send, status }));
    const request = {
      body: undefined,
      headers: { host: "localhost:3001" },
      id: "request_1",
      log: {
        error: vi.fn(),
      },
      method: "POST",
      url: "/api/auth/admin/stop-impersonating",
    };
    const reply = { header, send, status };

    await handleAuthRequest(request as never, reply as never, 3001);

    expect(mocks.logImpersonationTransition).toHaveBeenCalledWith({
      requestBody: undefined,
      requestId: "request_1",
      requestUrl: "/api/auth/admin/stop-impersonating",
      response: expect.any(Response),
      session,
    });
  });
});
