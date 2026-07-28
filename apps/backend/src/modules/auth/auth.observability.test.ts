import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logObservabilityEvent: vi.fn(),
}));

vi.mock("../observability/observability.service.ts", () => ({
  logObservabilityEvent: mocks.logObservabilityEvent,
}));

import { logImpersonationTransition } from "./auth.observability.ts";

describe("logImpersonationTransition", () => {
  beforeEach(() => {
    mocks.logObservabilityEvent.mockReset();
  });

  it("logs impersonation start fields", async () => {
    await logImpersonationTransition({
      requestBody: { userId: "user_1" },
      requestId: "request_1",
      requestUrl: "/api/auth/admin/impersonate-user",
      response: new Response(
        JSON.stringify({
          session: { id: "session_impersonated" },
          user: { id: "user_1" },
        }),
      ),
      session: {
        session: {
          id: "session_admin",
          impersonatedBy: null,
        },
        user: {
          id: "admin_1",
        },
      },
    });

    expect(mocks.logObservabilityEvent).toHaveBeenCalledWith(
      "auth.impersonation.started",
      {
        actorUserId: "admin_1",
        effectiveUserId: "user_1",
        requestId: "request_1",
        sessionId: "session_impersonated",
      },
    );
  });

  it("logs impersonation stop fields", async () => {
    await logImpersonationTransition({
      requestBody: undefined,
      requestId: "request_1",
      requestUrl: "/api/auth/admin/stop-impersonating",
      response: new Response(JSON.stringify({ ok: true })),
      session: {
        session: {
          id: "session_1",
          impersonatedBy: "admin_1",
        },
        user: {
          id: "user_1",
        },
      },
    });

    expect(mocks.logObservabilityEvent).toHaveBeenCalledWith(
      "auth.impersonation.stopped",
      {
        actorUserId: "admin_1",
        effectiveUserId: "user_1",
        requestId: "request_1",
        sessionId: "session_1",
      },
    );
  });
});
