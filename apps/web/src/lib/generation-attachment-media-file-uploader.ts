import type { GenerationAttachmentMediaFileUploader } from "@remora/app/generation";
import type { GenerationAttachmentMediaUploadResult } from "@remora/domain/generation-attachment-media/dto";

import { apiOrigin } from "./api-origin";

export class GenerationAttachmentMediaUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GenerationAttachmentMediaUploadError";
  }
}

export const uploadGenerationAttachmentMediaFile: GenerationAttachmentMediaFileUploader =
  async ({ file, kind }) => {
    const formData = new FormData();

    formData.set("kind", kind);
    formData.set("file", file, file.name);

    const response = await fetch(
      new URL("/api/generation/attachment-media", apiOrigin),
      {
        method: "POST",
        credentials: "include",
        body: formData,
      },
    );

    if (!response.ok) {
      throw new GenerationAttachmentMediaUploadError(
        await getUploadErrorMessage(response),
        response.status,
      );
    }

    return (await response.json()) as GenerationAttachmentMediaUploadResult;
  };

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
