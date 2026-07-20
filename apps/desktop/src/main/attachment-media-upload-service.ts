import { ipcMain } from "electron";

import { getStoredSessionCookie } from "./auth-service.ts";
import { env } from "./env.ts";
import {
  addDesktopBackendRequestBreadcrumb,
  wrapIpcHandler,
} from "./observability.ts";
import {
  attachmentMediaChannel,
  type DesktopAttachmentMediaUploadRequest,
} from "../shared/attachment-media.ts";
import type { GenerationAttachmentMediaUploadResult } from "@remora/domain/generation-attachment-media/dto";

export function setupAttachmentMediaUploadService() {
  const channel = `${attachmentMediaChannel}:upload`;

  ipcMain.handle(
    channel,
    wrapIpcHandler(
      channel,
      (_event, request: DesktopAttachmentMediaUploadRequest) =>
        uploadAttachmentMedia(request),
    ),
  );
}

async function uploadAttachmentMedia(
  request: DesktopAttachmentMediaUploadRequest,
): Promise<GenerationAttachmentMediaUploadResult> {
  const sessionCookie = await getStoredSessionCookie();
  const formData = new FormData();
  const headers = new Headers();

  formData.set("kind", request.kind);
  formData.set(
    "file",
    new Blob([request.data], {
      type: request.contentType,
    }),
    request.fileName,
  );

  if (sessionCookie) {
    headers.set("cookie", sessionCookie);
  }

  const url = new URL(
    "/api/generation/attachment-media",
    env.DESKTOP_API_ORIGIN,
  );
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    addDesktopBackendRequestBreadcrumb({
      url: url.toString(),
      method: "POST",
      status: response.status,
      requestId: response.headers.get("x-remora-request-id"),
      traceId: response.headers.get("x-remora-trace-id"),
      spanId: response.headers.get("x-remora-span-id"),
    });

    throw new Error(await getUploadErrorMessage(response));
  }

  return (await response.json()) as GenerationAttachmentMediaUploadResult;
}

async function getUploadErrorMessage(response: Response) {
  const fallback = `Attachment upload failed with ${response.status}`;

  try {
    const body = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };

    if (typeof body.message === "string") {
      return body.message;
    }

    if (typeof body.error === "string") {
      return body.error;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
