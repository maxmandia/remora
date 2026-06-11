export type { RealtimeClientEvent } from "@remora/realtime";

import type { RealtimeClientEvent } from "@remora/realtime";

export const realtimeNotificationChannel = "remora_realtime_events";

export type RealtimeInternalEvent = RealtimeClientEvent & {
  userId: string;
};
