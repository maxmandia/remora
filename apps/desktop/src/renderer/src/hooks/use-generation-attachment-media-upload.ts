import { useCallback, useState } from "react";

import type {
  AttachmentMediaRole,
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaUploadResult,
} from "@remora/backend/types";

import type { GenerationAttachmentMediaValue } from "../lib/generation/attachment-media.ts";

export type UploadedGenerationAttachmentMediaItem = {
  id: string;
  role: AttachmentMediaRole;
};

export type UploadedGenerationAttachmentMediaValue = Partial<
  Record<
    GenerationAttachmentMediaFieldId,
    UploadedGenerationAttachmentMediaItem[]
  >
>;

export function useGenerationAttachmentMediaUpload() {
  const [isAttachmentMediaUploadPending, setIsAttachmentMediaUploadPending] =
    useState(false);

  const uploadAttachmentMedia = useCallback(
    async (
      value: GenerationAttachmentMediaValue,
    ): Promise<UploadedGenerationAttachmentMediaValue> => {
      setIsAttachmentMediaUploadPending(true);

      try {
        const uploaded: UploadedGenerationAttachmentMediaValue = {};

        for (const fieldId of ["images", "videos", "audios"] as const) {
          const items = value[fieldId];

          if (items.length === 0) {
            continue;
          }

          uploaded[fieldId] = await uploadAttachmentMediaFiles({
            fieldId,
            items,
          });
        }

        return uploaded;
      } finally {
        setIsAttachmentMediaUploadPending(false);
      }
    },
    [],
  );

  return { isAttachmentMediaUploadPending, uploadAttachmentMedia };
}

async function uploadAttachmentMediaFiles({
  fieldId,
  items,
}: {
  fieldId: GenerationAttachmentMediaFieldId;
  items: GenerationAttachmentMediaValue[GenerationAttachmentMediaFieldId];
}) {
  const uploaded: UploadedGenerationAttachmentMediaItem[] = [];

  for (const item of items) {
    const uploadedItem: GenerationAttachmentMediaUploadResult =
      await window.remoraAttachmentMedia.upload({
        kind: getAttachmentMediaKindForFieldId(fieldId),
        fileName: item.file.name,
        contentType: item.file.type,
        data: await item.file.arrayBuffer(),
      });

    uploaded.push({ id: uploadedItem.id, role: item.role });
  }

  return uploaded;
}

function getAttachmentMediaKindForFieldId(
  fieldId: GenerationAttachmentMediaFieldId,
): GenerationAttachmentMediaKind {
  switch (fieldId) {
    case "images":
      return "image";
    case "videos":
      return "video";
    case "audios":
      return "audio";
  }
}
