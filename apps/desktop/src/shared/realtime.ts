export {
  isRealtimeClientEvent,
  parseRealtimeClientEvent,
} from "@remora/realtime";
export type {
  RealtimeClientEvent,
  RealtimeConnectionStatus,
} from "@remora/realtime";

export const realtimeChannel = "remora-realtime";

export type { RealtimeClient as DesktopRealtimeBridge } from "@remora/realtime";
