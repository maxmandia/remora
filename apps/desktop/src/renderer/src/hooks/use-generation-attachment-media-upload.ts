import { useCallback, useState } from "react";

import type {
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaUploadResult,
} from "@remora/backend/types";

import type { GenerationAttachmentMediaValue } from "../lib/generation/attachment-media.ts";

export type UploadedGenerationAttachmentMediaValue = Partial<
  Record<GenerationAttachmentMediaFieldId, string[]>
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
          const files = value[fieldId];

          if (files.length === 0) {
            continue;
          }

          uploaded[fieldId] = await uploadAttachmentMediaFiles({
            fieldId,
            files,
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
  files,
}: {
  fieldId: GenerationAttachmentMediaFieldId;
  files: File[];
}) {
  const uploaded: GenerationAttachmentMediaUploadResult[] = [];

  for (const file of files) {
    uploaded.push(
      await window.remoraAttachmentMedia.upload({
        kind: getAttachmentMediaKindForFieldId(fieldId),
        fileName: file.name,
        contentType: file.type,
        data: await file.arrayBuffer(),
      }),
    );
  }

  return uploaded.map((item) => item.id);
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
