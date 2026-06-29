import { describe, expect, it } from "vitest";

import { getDesktopNavigationTargetFromDeepLink } from "./navigation-deep-link.ts";

const protocolScheme = "app.remora.desktop";

describe("getDesktopNavigationTargetFromDeepLink", () => {
  it("extracts the credits settings route from two-slash protocol URLs", () => {
    expect(
      getDesktopNavigationTargetFromDeepLink(
        "app.remora.desktop://app/settings/credits?credit_checkout=success",
        { protocolScheme },
      ),
    ).toEqual({ to: "/app/settings/credits" });
  });

  it("extracts the credits settings route from one-slash protocol URLs", () => {
    expect(
      getDesktopNavigationTargetFromDeepLink(
        "app.remora.desktop:/app/settings/credits?credit_checkout=success",
        { protocolScheme },
      ),
    ).toEqual({ to: "/app/settings/credits" });
  });

  it("rejects unsupported routes", () => {
    expect(
      getDesktopNavigationTargetFromDeepLink(
        "app.remora.desktop://app/settings/profile",
        { protocolScheme },
      ),
    ).toBeNull();
  });

  it("rejects URLs with the wrong scheme", () => {
    expect(
      getDesktopNavigationTargetFromDeepLink(
        "other.remora.desktop://app/settings/credits",
        { protocolScheme },
      ),
    ).toBeNull();
  });
});
