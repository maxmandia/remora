import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();
const flushMock = vi.fn(async () => true);
const initMock = vi.fn(() => ({}) as never);
type ScopeMock = {
  setContext: ReturnType<typeof vi.fn>;
  setTag: ReturnType<typeof vi.fn>;
};
const scope: ScopeMock = {
  setContext: vi.fn(),
  setTag: vi.fn(),
};

vi.mock("@sentry/node", () => ({
  captureException: captureExceptionMock,
  flush: flushMock,
  init: initMock,
  SentryContextManager: AsyncLocalStorageContextManager,
  withScope: (callback: (scope: ScopeMock) => void) => callback(scope),
}));

describe("observability service", () => {
  beforeEach(() => {
    vi.stubEnv("SENTRY_DSN", "https://public@example.test/1");
    vi.stubEnv(
      "SENTRY_TRACE_URL_TEMPLATE",
      "https://grafana.example.test/explore?traceId={traceId}",
    );
  });

  afterEach(async () => {
    const { shutdownObservability } =
      await import("./observability.service.ts");

    await shutdownObservability();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("redacts sensitive observability fields", async () => {
    const { initializeObservability, logObservabilityEvent } =
      await import("./observability.service.ts");
    const loggerInfo = vi.fn();

    initializeObservability({ serviceName: "test-backend" }).logger.info =
      loggerInfo;

    logObservabilityEvent("test.event", {
      userId: "user_1",
      prompt: "do not capture",
      callbackUrl: "https://callback.example.test/token",
      localFilePath: "/Users/max/secret/image.png",
      nested: {
        rawPayload: { token: "secret" },
        message: "failed https://provider.example.test/output.png",
      },
    });

    expect(loggerInfo).toHaveBeenCalledWith(
      {
        userId: "user_1",
        nested: {
          message: "failed [redacted-url]",
        },
      },
      "test.event",
    );
  });

  it("captures unexpected errors with active trace metadata", async () => {
    const { initializeObservability, runWithSpan } =
      await import("./observability.service.ts");

    initializeObservability({ serviceName: "test-backend" });

    await expect(
      runWithSpan(
        "test.operation",
        {
          userId: "user_1",
          jobId: "job_1",
          prompt: "do not capture",
        },
        async () => {
          throw new Error("Provider failed https://provider.example.test");
        },
      ),
    ).rejects.toThrow("Provider failed");

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(scope.setTag).toHaveBeenCalledWith("service", "test-backend");
    expect(scope.setTag).toHaveBeenCalledWith("userId", "user_1");
    expect(scope.setTag).toHaveBeenCalledWith("jobId", "job_1");
    expect(scope.setTag).not.toHaveBeenCalledWith("prompt", "do not capture");

    const traceTag = scope.setTag.mock.calls.find(
      ([key]) => key === "trace_id",
    );
    const spanTag = scope.setTag.mock.calls.find(([key]) => key === "span_id");
    const contextCall = scope.setContext.mock.calls.find(
      ([key]) => key === "remora",
    );

    expect(traceTag?.[1]).toMatch(/^[a-f0-9]{32}$/);
    expect(spanTag?.[1]).toMatch(/^[a-f0-9]{16}$/);
    expect(contextCall?.[1]).toMatchObject({
      userId: "user_1",
      jobId: "job_1",
      serviceName: "test-backend",
      traceUrl: expect.stringContaining(String(traceTag?.[1])),
    });
  });
});
