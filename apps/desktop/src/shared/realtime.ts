export {
  isRealtimeClientEvent,
  parseRealtimeClientEvent,
} from "@remora/realtime";
export type { RealtimeClientEvent } from "@remora/realtime";

import type { RealtimeClientEvent } from "@remora/realtime";

export const realtimeChannel = "remora-realtime";

export type RealtimeConnectionStatus = "connected" | "disconnected";

export type DesktopRealtimeBridge = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  onEvent: (callback: (event: RealtimeClientEvent) => void) => () => void;
  onConnectionChange: (
    callback: (status: RealtimeConnectionStatus) => void,
  ) => () => void;
};
