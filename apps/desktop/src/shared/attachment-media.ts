import type {
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaUploadResult,
} from "@remora/domain/generation-attachment-media/dto";

export const attachmentMediaChannel = "remora-attachment-media";

export type DesktopAttachmentMediaUploadRequest = {
  kind: GenerationAttachmentMediaKind;
  fileName: string;
  contentType: string;
  data: ArrayBuffer;
};

export type DesktopAttachmentMediaBridge = {
  upload: (
    request: DesktopAttachmentMediaUploadRequest,
  ) => Promise<GenerationAttachmentMediaUploadResult>;
};
