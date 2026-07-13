/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({
  events: [] as string[],
}));

vi.mock("./lib/analytics.ts", () => ({
  initializeRendererAnalytics: () => startup.events.push("analytics"),
}));
vi.mock("./lib/observability.ts", () => ({
  initializeRendererObservability: () => startup.events.push("observability"),
}));
vi.mock("./router.tsx", () => ({
  router: { navigate: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({
  RouterProvider: () => null,
}));
vi.mock("react-dom/client", () => ({
  createRoot: () => ({
    render: () => startup.events.push("render"),
  }),
}));

describe("renderer startup", () => {
  beforeEach(() => {
    startup.events.length = 0;
    document.body.innerHTML = '<div id="root"></div>';
    window.remoraNavigation = {
      onNavigate: vi.fn(),
    } as never;
  });

  it("initializes analytics before React renders", async () => {
    await import("./main.tsx");

    expect(startup.events).toEqual(["analytics", "observability", "render"]);
  });
});
