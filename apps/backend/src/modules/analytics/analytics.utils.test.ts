import { describe, expect, it } from "vitest";

import { createAnalyticsInsertId } from "./analytics.utils.ts";

describe("analytics utils", () => {
  it("creates deterministic, namespaced insert ids without exposing entity ids", () => {
    const first = createAnalyticsInsertId("project_created", "project_123");
    const repeated = createAnalyticsInsertId("project_created", "project_123");
    const otherEvent = createAnalyticsInsertId(
      "account_signed_up",
      "project_123",
    );

    expect(first).toBe(repeated);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("project_123");
    expect(otherEvent).not.toBe(first);
  });
});
