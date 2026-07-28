import type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";

export const generatedImageChannel = "remora-generated-image";

export type DesktopGeneratedImageRoleChoice = {
  disabled: boolean;
  role: AttachmentMediaRole;
};

export type DesktopGeneratedImageContextMenuRequest = {
  jobId: string;
  roleChoices: DesktopGeneratedImageRoleChoice[];
};

export type DesktopGeneratedImageContextMenuResult = {
  role: AttachmentMediaRole;
} | null;

export type DesktopGeneratedImageFileRequest = {
  jobId: string;
};

export type DesktopGeneratedImageFile = {
  contentType: string;
  data: ArrayBuffer;
  fileName: string;
};

export type DesktopGeneratedImageBridge = {
  showContextMenu(
    request: DesktopGeneratedImageContextMenuRequest,
  ): Promise<DesktopGeneratedImageContextMenuResult>;
  loadFile(
    request: DesktopGeneratedImageFileRequest,
  ): Promise<DesktopGeneratedImageFile>;
};
