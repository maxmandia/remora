import type { DesktopGeneratedImageBridge } from "../../../shared/generated-image.ts";

export const generatedImageBridge: DesktopGeneratedImageBridge = {
  loadFile: (request) => window.remoraGeneratedImage.loadFile(request),
  showContextMenu: (request) =>
    window.remoraGeneratedImage.showContextMenu(request),
};
