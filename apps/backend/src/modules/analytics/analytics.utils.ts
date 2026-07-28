import { createHash } from "node:crypto";

import type { AnalyticsDeliveryContext } from "./analytics.types.ts";

export function createAnalyticsInsertId(
  eventName: string,
  occurrenceId: string,
): string {
  return createHash("sha256")
    .update(`${eventName}:${occurrenceId}`)
    .digest("hex");
}

export function parseAnalyticsDeliveryContext(
  suppressedFlag: string | undefined,
): AnalyticsDeliveryContext | null {
  if (suppressedFlag === undefined || suppressedFlag === "false") {
    return { suppressed: false };
  }

  if (suppressedFlag === "true") {
    return { suppressed: true };
  }

  return null;
}
