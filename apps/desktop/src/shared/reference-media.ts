import type {
  GenerationReferenceMediaKind,
  GenerationReferenceMediaUploadResult,
} from "@remora/backend/types";

export const referenceMediaChannel = "remora-reference-media";

export type DesktopReferenceMediaUploadRequest = {
  kind: GenerationReferenceMediaKind;
  fileName: string;
  contentType: string;
  data: ArrayBuffer;
};

export type DesktopReferenceMediaBridge = {
  upload: (
    request: DesktopReferenceMediaUploadRequest,
  ) => Promise<GenerationReferenceMediaUploadResult>;
};
