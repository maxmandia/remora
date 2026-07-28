import type {
  GeneratedImageAttachmentRoleChoice,
  GeneratedImageDescriptor,
} from "@remora/app/generation";
import type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";
import { toast } from "@remora/ui";
import { useCallback, type MouseEvent } from "react";

import { generatedImageBridge } from "../lib/generated-image-bridge.ts";

export function useGeneratedImageContextMenuHandler({
  getRoleChoices,
  onAdd,
}: {
  getRoleChoices: (
    image: GeneratedImageDescriptor,
  ) => GeneratedImageAttachmentRoleChoice[];
  onAdd: (image: GeneratedImageDescriptor, role: AttachmentMediaRole) => void;
}) {
  return useCallback(
    (image: GeneratedImageDescriptor, event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      void generatedImageBridge
        .showContextMenu({
          jobId: image.jobId,
          roleChoices: getRoleChoices(image),
        })
        .then((result) => {
          if (result) {
            onAdd(image, result.role);
          }
        })
        .catch(() => toast.error("Unable to open image menu."));
    },
    [getRoleChoices, onAdd],
  );
}

export async function loadGeneratedImageFile(
  image: GeneratedImageDescriptor,
): Promise<File> {
  const loaded = await generatedImageBridge.loadFile({ jobId: image.jobId });

  return new File([loaded.data], loaded.fileName, {
    type: loaded.contentType,
  });
}
