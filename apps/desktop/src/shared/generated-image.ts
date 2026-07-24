export const generatedImageChannel = "remora-generated-image";

export type DesktopGeneratedImageContextMenuRequest = {
  jobId: string;
};

export type DesktopGeneratedImageBridge = {
  showContextMenu(
    request: DesktopGeneratedImageContextMenuRequest,
  ): Promise<void>;
};
