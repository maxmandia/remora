import { ipcMain } from "electron";

import { getStoredSessionCookie } from "./auth-service.ts";
import { env } from "./env.ts";
import {
  referenceMediaChannel,
  type DesktopReferenceMediaUploadRequest,
} from "../shared/reference-media.ts";
import type { GenerationReferenceMediaUploadResult } from "@remora/backend/types";

export function setupReferenceMediaUploadService() {
  ipcMain.handle(
    `${referenceMediaChannel}:upload`,
    (_event, request: DesktopReferenceMediaUploadRequest) =>
      uploadReferenceMedia(request),
  );
}

async function uploadReferenceMedia(
  request: DesktopReferenceMediaUploadRequest,
): Promise<GenerationReferenceMediaUploadResult> {
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

  const response = await fetch(
    new URL("/api/generation/reference-media", env.DESKTOP_API_ORIGIN),
    {
      method: "POST",
      headers,
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(await getUploadErrorMessage(response));
  }

  return (await response.json()) as GenerationReferenceMediaUploadResult;
}

async function getUploadErrorMessage(response: Response) {
  const fallback = `Reference media upload failed with ${response.status}`;

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
