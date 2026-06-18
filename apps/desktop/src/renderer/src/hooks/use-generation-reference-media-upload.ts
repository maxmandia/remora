import { useCallback, useState } from "react";

import type {
  GenerationReferenceMediaFieldId,
  GenerationReferenceMediaKind,
  GenerationReferenceMediaUploadResult,
} from "@remora/backend/types";

import type { GenerationReferenceMediaValue } from "../lib/generation/reference-media.ts";

export type UploadedGenerationReferenceMediaValue = Partial<
  Record<GenerationReferenceMediaFieldId, string[]>
>;

export function useGenerationReferenceMediaUpload() {
  const [isReferenceMediaUploadPending, setIsReferenceMediaUploadPending] =
    useState(false);

  const uploadReferenceMedia = useCallback(
    async (
      value: GenerationReferenceMediaValue,
    ): Promise<UploadedGenerationReferenceMediaValue> => {
      setIsReferenceMediaUploadPending(true);

      try {
        const uploaded: UploadedGenerationReferenceMediaValue = {};

        for (const fieldId of ["images", "videos", "audios"] as const) {
          const files = value[fieldId];

          if (files.length === 0) {
            continue;
          }

          uploaded[fieldId] = await uploadReferenceMediaFiles({
            fieldId,
            files,
          });
        }

        return uploaded;
      } finally {
        setIsReferenceMediaUploadPending(false);
      }
    },
    [],
  );

  return { isReferenceMediaUploadPending, uploadReferenceMedia };
}

async function uploadReferenceMediaFiles({
  fieldId,
  files,
}: {
  fieldId: GenerationReferenceMediaFieldId;
  files: File[];
}) {
  const uploaded: GenerationReferenceMediaUploadResult[] = [];

  for (const file of files) {
    uploaded.push(
      await window.remoraReferenceMedia.upload({
        kind: getReferenceMediaKindForFieldId(fieldId),
        fileName: file.name,
        contentType: file.type,
        data: await file.arrayBuffer(),
      }),
    );
  }

  return uploaded.map((item) => item.id);
}

function getReferenceMediaKindForFieldId(
  fieldId: GenerationReferenceMediaFieldId,
): GenerationReferenceMediaKind {
  switch (fieldId) {
    case "images":
      return "image";
    case "videos":
      return "video";
    case "audios":
      return "audio";
  }
}
