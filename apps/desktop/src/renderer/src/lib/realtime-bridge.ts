export const realtimeBridge = {
  connect: () => window.remoraRealtime.connect(),
  disconnect: () => window.remoraRealtime.disconnect(),
  onEvent: (callback: Parameters<typeof window.remoraRealtime.onEvent>[0]) =>
    window.remoraRealtime.onEvent(callback),
  onConnectionChange: (
    callback: Parameters<typeof window.remoraRealtime.onConnectionChange>[0],
  ) => window.remoraRealtime.onConnectionChange(callback),
};
