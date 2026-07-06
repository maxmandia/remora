import * as Sentry from "@sentry/electron/renderer";

declare const __REMORA_DESKTOP_SENTRY_ENABLED__: boolean;

type DesktopRendererSentryOptions = Parameters<typeof Sentry.init>[0];

export function getDesktopRendererSentryOptions(): DesktopRendererSentryOptions {
  return {
    sendDefaultPii: true,
  };
}

export function initializeDesktopRendererObservability(): void {
  if (!__REMORA_DESKTOP_SENTRY_ENABLED__) {
    return;
  }

  Sentry.init(getDesktopRendererSentryOptions());
}
