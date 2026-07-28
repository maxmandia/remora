import {
  getGeneratedImageFileName,
  type GeneratedImageDescriptor,
} from "@remora/app/generation";

import { apiOrigin } from "./api-origin";

export async function loadGeneratedImageFile(
  image: GeneratedImageDescriptor,
): Promise<File> {
  const response = await fetch(getGeneratedImageFileUrl(image.jobId), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Generated image request failed with ${response.status}`);
  }

  const blob = await response.blob();
  const contentType = blob.type || image.contentType || "";

  return new File(
    [blob],
    getContentDispositionFilename(
      response.headers.get("content-disposition"),
    ) ??
      getGeneratedImageFileName({
        contentType: contentType || null,
        jobId: image.jobId,
      }),
    { type: contentType },
  );
}

export function downloadGeneratedImage(image: GeneratedImageDescriptor) {
  const anchor = document.createElement("a");

  anchor.href = getGeneratedImageFileUrl(image.jobId);
  anchor.rel = "noopener";
  anchor.target = "_blank";
  anchor.click();
}

export function getGeneratedImageFileUrl(jobId: string) {
  return new URL(
    `/api/generation/jobs/${encodeURIComponent(jobId)}/image-file`,
    apiOrigin,
  ).toString();
}

function getContentDispositionFilename(value: string | null) {
  const filename = value?.match(/filename="([^"]+)"/i)?.[1]?.trim();

  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(filename)
  ) {
    return null;
  }

  return filename;
}
