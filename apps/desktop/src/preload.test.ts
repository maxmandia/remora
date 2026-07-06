import { afterEach, describe, expect, it, vi } from "vitest";

const preloadMocks = vi.hoisted(() => {
  const calls: string[] = [];

  return {
    calls,
    initializePreloadObservability: vi.fn(() => {
      calls.push("initializePreloadObservability");
    }),
    setupPreloadBridge: vi.fn(() => {
      calls.push("setupPreloadBridge");
    }),
  };
});

vi.mock("./preload/observability.ts", () => ({
  initializePreloadObservability:
    preloadMocks.initializePreloadObservability,
}));

vi.mock("./preload/index.ts", () => ({
  setupPreloadBridge: preloadMocks.setupPreloadBridge,
}));

describe("preload entrypoint", () => {
  afterEach(() => {
    preloadMocks.calls.length = 0;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("initializes observability before setting up preload bridges", async () => {
    await import("./preload.ts");

    expect(preloadMocks.calls).toEqual([
      "initializePreloadObservability",
      "setupPreloadBridge",
    ]);
  });
});
