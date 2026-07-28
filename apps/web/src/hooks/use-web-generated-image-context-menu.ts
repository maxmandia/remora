import type {
  GeneratedImageContextMenuActions,
  useGeneratedImageAttachment,
} from "@remora/app/generation";
import { useMemo } from "react";

import { downloadGeneratedImage } from "../lib/generated-image-file";

type GeneratedImageAttachment = ReturnType<typeof useGeneratedImageAttachment>;

export function useWebGeneratedImageContextMenu(
  attachment: GeneratedImageAttachment,
): GeneratedImageContextMenuActions {
  const { addGeneratedImage, getRoleChoices, isPending } = attachment;

  return useMemo(
    () => ({
      getRoleChoices: (image) =>
        getRoleChoices(image).map((choice) => ({
          ...choice,
          disabled: choice.disabled || isPending(image, choice.role),
        })),
      onAdd: (image, role) => {
        void addGeneratedImage(image, role);
      },
      onDownload: downloadGeneratedImage,
    }),
    [addGeneratedImage, getRoleChoices, isPending],
  );
}
