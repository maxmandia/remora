import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mixpanelMocks = vi.hoisted(() => ({
  init: vi.fn(),
}));

vi.mock("mixpanel", () => ({ default: mixpanelMocks }));

describe("analytics service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mixpanelMocks.init.mockReset();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is disabled when local configuration is missing", async () => {
    const { AnalyticsService } = await import("./analytics.service.ts");

    new AnalyticsService().initialize();

    expect(mixpanelMocks.init).not.toHaveBeenCalled();
  });

  it("configures the US host without server-side geolocation", async () => {
    vi.stubEnv("MIXPANEL_PROJECT_TOKEN", "project-token");
    mixpanelMocks.init.mockReturnValue({ track: vi.fn() });
    const { AnalyticsService } = await import("./analytics.service.ts");

    new AnalyticsService().initialize();

    expect(mixpanelMocks.init).toHaveBeenCalledOnce();
    expect(mixpanelMocks.init).toHaveBeenCalledWith("project-token", {
      geolocate: false,
      host: "api.mixpanel.com",
    });
  });

  it("initializes at most once", async () => {
    vi.stubEnv("MIXPANEL_PROJECT_TOKEN", "project-token");
    mixpanelMocks.init.mockReturnValue({ track: vi.fn() });
    const { AnalyticsService } = await import("./analytics.service.ts");
    const service = new AnalyticsService();

    service.initialize();
    service.initialize();

    expect(mixpanelMocks.init).toHaveBeenCalledOnce();
  });

  it("contains initialization and configuration failures", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { AnalyticsService } = await import("./analytics.service.ts");

    expect(() => new AnalyticsService().initialize()).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Backend analytics initialization failed",
      expect.any(Error),
    );

    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("MIXPANEL_PROJECT_TOKEN", "project-token");
    const sdkError = new Error("SDK initialization failed");
    mixpanelMocks.init.mockImplementation(() => {
      throw sdkError;
    });
    const { AnalyticsService: FreshAnalyticsService } =
      await import("./analytics.service.ts");

    expect(() => new FreshAnalyticsService().initialize()).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Backend analytics initialization failed",
      sdkError,
    );
  });

  it("contains synchronous and callback delivery failures", async () => {
    vi.stubEnv("MIXPANEL_PROJECT_TOKEN", "project-token");
    const callbackError = new Error("callback failed");
    const synchronousError = new Error("track failed");
    const track = vi
      .fn()
      .mockImplementationOnce(
        (_event, _properties, callback: (error?: Error) => void) =>
          callback(callbackError),
      )
      .mockImplementationOnce(() => {
        throw synchronousError;
      });
    mixpanelMocks.init.mockReturnValue({ track });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { AnalyticsService } = await import("./analytics.service.ts");
    const service = new AnalyticsService();
    service.initialize();

    expect(() =>
      service.track({
        type: "project_created",
        userId: "user_1",
        projectId: "project_1",
        occurredAt: new Date("2026-07-13T12:00:00.000Z"),
      }),
    ).not.toThrow();
    expect(() =>
      service.track({
        type: "project_created",
        userId: "user_1",
        projectId: "project_2",
        occurredAt: new Date("2026-07-13T12:00:00.000Z"),
      }),
    ).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Backend analytics delivery failed",
      callbackError,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Backend analytics delivery failed",
      synchronousError,
    );
  });

  it("maps typed events to the privacy-safe backend contract", async () => {
    vi.stubEnv("MIXPANEL_PROJECT_TOKEN", "project-token");
    const track = vi.fn();
    mixpanelMocks.init.mockReturnValue({ track });
    const { AnalyticsService } = await import("./analytics.service.ts");
    const service = new AnalyticsService();
    const occurredAt = new Date("2026-07-13T12:00:00.000Z");
    const generation = {
      modelType: "video" as const,
      modelId: "model_1",
      modelSpecId: "spec_1",
      requestedOutputCount: 2,
      resolution: "1080p",
      aspectRatio: "16:9",
      generationDurationSeconds: 5,
      generateAudio: true,
      attachmentCount: 3,
      hasImageAttachment: true,
      hasVideoAttachment: true,
      hasAudioAttachment: false,
    };

    service.initialize();
    service.track({
      type: "account_signed_up",
      userId: "user_1",
      occurredAt,
    });
    service.track({
      type: "generation_submission_created",
      userId: "user_1",
      occurredAt,
      submissionId: "submission_1",
      generation,
      targetType: "new_project_thread",
      estimatedCostUsdMicrosPerOutput: 10,
      estimatedCostUsdMicrosTotal: 20,
    });
    service.track({
      type: "generation_job_succeeded",
      userId: "user_1",
      occurredAt,
      jobId: "job_1",
      generation,
      outputIndex: 0,
      providerId: "provider_1",
      providerModelId: "provider_model_1",
      processingDurationMs: 4_000,
    });
    service.track({
      type: "generation_job_failed",
      userId: "user_1",
      occurredAt,
      jobId: "job_2",
      generation,
      outputIndex: 1,
      providerId: "provider_1",
      processingDurationMs: 5_000,
      terminalStatus: "failed",
      errorSource: "provider",
      errorCode: "RATE_LIMITED",
    });
    service.track({
      type: "insufficient_credits_encountered",
      userId: "user_1",
      occurredAt,
      generation,
      targetType: "existing_thread",
      requiredCreditUsdMicrosPerOutput: 10,
      requiredCreditUsdMicrosTotal: 20,
    });
    service.track({
      type: "project_created",
      userId: "user_1",
      occurredAt,
      projectId: "project_1",
    });
    service.track({
      type: "credit_checkout_started",
      userId: "user_1",
      occurredAt,
      stripeCheckoutSessionId: "checkout_1",
      creditAmountUsdMicros: 25_000_000,
      autoTopUpSelected: true,
    });
    service.track({
      type: "credit_purchase_completed",
      userId: "user_1",
      occurredAt,
      ledgerEntryId: "ledger_1",
      purchaseKind: "manual",
      creditAmountUsdMicros: 25_000_000,
      autoTopUpSelected: false,
    });
    expect(track.mock.calls.map(([eventName]) => eventName)).toEqual([
      "account_signed_up",
      "generation_submission_created",
      "generation_job_succeeded",
      "generation_job_failed",
      "insufficient_credits_encountered",
      "project_created",
      "credit_checkout_started",
      "credit_purchase_completed",
    ]);
    expect(track).toHaveBeenCalledWith(
      "generation_job_failed",
      expect.objectContaining({
        event_version: 1,
        distinct_id: "user_1",
        $user_id: "user_1",
        $insert_id: expect.stringMatching(/^[a-f0-9]{64}$/),
        time: Math.floor(occurredAt.getTime() / 1_000),
        model_id: "model_1",
        output_index: 1,
        terminal_status: "failed",
        error_source: "provider",
        error_code: "RATE_LIMITED",
      }),
      expect.any(Function),
    );
    expect(track).toHaveBeenCalledWith(
      "credit_purchase_completed",
      expect.not.objectContaining({ top_up_floor_usd_micros: undefined }),
      expect.any(Function),
    );
    expect(JSON.stringify(track.mock.calls)).not.toContain("submission_1");
    expect(JSON.stringify(track.mock.calls)).not.toContain("checkout_1");
    expect(JSON.stringify(track.mock.calls)).not.toContain("ledger_1");
  });

  it("rejects unhandled event variants", async () => {
    const { AnalyticsService } = await import("./analytics.service.ts");
    const service = new AnalyticsService();

    expect(() => service.track({ type: "unsupported_event" } as never)).toThrow(
      "Unhandled value: [object Object]",
    );
  });
});
