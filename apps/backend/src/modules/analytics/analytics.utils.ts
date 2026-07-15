import { createHash } from "node:crypto";

export function createAnalyticsInsertId(
  eventName: string,
  occurrenceId: string,
): string {
  return createHash("sha256")
    .update(`${eventName}:${occurrenceId}`)
    .digest("hex");
}
