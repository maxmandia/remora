import { initializeDesktopRendererObservability } from "../shared/renderer-observability.ts";

// Adding a wrapper function here if we want to pass custom Sentry options
export function initializePreloadObservability(): void {
  initializeDesktopRendererObservability();
}
