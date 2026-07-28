import { logObservabilityEvent } from "../observability/observability.service.ts";
import {
  readImpersonatedUserId,
  readImpersonationTransition,
} from "./auth.utils.ts";

export function logAuthLifecycleEvent(
  event: AuthLifecycleEvent,
  fields: AuthLifecycleFields = {},
): void {
  logObservabilityEvent(event, fields);
}

export async function logImpersonationTransition({
  requestBody,
  requestId,
  requestUrl,
  response,
  session,
}: {
  requestBody: unknown;
  requestId: string;
  requestUrl: string;
  response: Response;
  session: ImpersonationObservabilitySession | null;
}): Promise<void> {
  if (!session) {
    return;
  }

  if (requestUrl.endsWith("/admin/impersonate-user")) {
    const transition = await readImpersonationTransition(response);
    const effectiveUserId =
      transition?.effectiveUserId ?? readImpersonatedUserId(requestBody);

    if (effectiveUserId) {
      logAuthLifecycleEvent("auth.impersonation.started", {
        actorUserId: session.user.id,
        effectiveUserId,
        requestId,
        sessionId: transition?.sessionId ?? session.session.id,
      });
    }
  }

  if (requestUrl.endsWith("/admin/stop-impersonating")) {
    logAuthLifecycleEvent("auth.impersonation.stopped", {
      actorUserId: session.session.impersonatedBy ?? session.user.id,
      effectiveUserId: session.user.id,
      requestId,
      sessionId: session.session.id,
    });
  }
}

export type AuthLifecycleEvent =
  | "auth.impersonation.started"
  | "auth.impersonation.stopped";

export type AuthLifecycleFields = {
  actorUserId?: string | null;
  effectiveUserId?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  [key: string]: unknown;
};

type ImpersonationObservabilitySession = {
  session: {
    id: string;
    impersonatedBy?: string | null;
  };
  user: {
    id: string;
  };
};
