import type { GenerationAttachmentMediaFileUploader } from "@remora/app/generation";

export const uploadGenerationAttachmentMediaFile: GenerationAttachmentMediaFileUploader =
  async ({ file, kind }) =>
    window.remoraAttachmentMedia.upload({
      kind,
      fileName: file.name,
      contentType: file.type,
      data: await file.arrayBuffer(),
    });
