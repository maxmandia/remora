import * as Sentry from "@sentry/electron/renderer";

import { initializeDesktopRendererObservability } from "../../../shared/renderer-observability.ts";

type BackendRequestBreadcrumb = {
  url: string;
  method: string;
  status: number;
  requestId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
};

export function initializeRendererObservability(): void {
  initializeDesktopRendererObservability();
}

export function setRendererObservabilityUser(userId: string | null): void {
  if (!Sentry.isInitialized()) {
    return;
  }

  Sentry.setUser(userId ? { id: userId } : null);
}

export function addFailedBackendRequestBreadcrumb({
  url,
  method,
  status,
  requestId,
  traceId,
  spanId,
}: BackendRequestBreadcrumb): void {
  if (!Sentry.isInitialized()) {
    return;
  }

  Sentry.addBreadcrumb({
    category: "backend.request",
    level: "error",
    message: `${method.toUpperCase()} ${getSafePath(url)} failed`,
    data: {
      method: method.toUpperCase(),
      status,
      requestId,
      traceId,
      spanId,
    },
  });
}

export function getBackendTraceBreadcrumbFields(response: Response) {
  return {
    requestId: response.headers.get("x-remora-request-id"),
    traceId: response.headers.get("x-remora-trace-id"),
    spanId: response.headers.get("x-remora-span-id"),
  };
}

function getSafePath(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    return url.pathname;
  } catch {
    return rawUrl.split("?")[0] ?? rawUrl;
  }
}
