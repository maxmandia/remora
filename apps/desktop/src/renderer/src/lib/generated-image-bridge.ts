import type { DesktopGeneratedImageBridge } from "../../../shared/generated-image.ts";

export const generatedImageBridge: DesktopGeneratedImageBridge = {
  showContextMenu: (request) =>
    window.remoraGeneratedImage.showContextMenu(request),
};
