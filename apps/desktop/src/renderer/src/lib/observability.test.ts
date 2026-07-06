import { afterEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  init: vi.fn(),
  isInitialized: vi.fn(() => false),
  setUser: vi.fn(),
}));

vi.mock("@sentry/electron/renderer", () => sentryMocks);

describe("renderer observability", () => {
  afterEach(() => {
    sentryMocks.init.mockClear();
    vi.unstubAllGlobals();
  });

  it("initializes Sentry with shared desktop renderer options", async () => {
    vi.stubGlobal("__REMORA_DESKTOP_SENTRY_ENABLED__", true);

    const { initializeRendererObservability } = await import(
      "./observability.ts"
    );

    initializeRendererObservability();

    expect(sentryMocks.init).toHaveBeenCalledWith({
      sendDefaultPii: false,
    });
  });

  it("extracts backend trace breadcrumb fields from response headers", async () => {
    const { getBackendTraceBreadcrumbFields } =
      await import("./observability.ts");
    const response = new Response(null, {
      headers: {
        "x-remora-request-id": "request-1",
        "x-remora-trace-id": "trace-1",
        "x-remora-span-id": "span-1",
      },
    });

    expect(getBackendTraceBreadcrumbFields(response)).toEqual({
      requestId: "request-1",
      traceId: "trace-1",
      spanId: "span-1",
    });
  });
});
