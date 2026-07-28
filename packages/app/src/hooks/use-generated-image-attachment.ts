import type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { toast } from "@remora/ui";
import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  appendAttachmentMediaFiles,
  getGenerationAttachmentMediaFieldSpecs,
  type GenerationAttachmentMediaValue,
} from "../lib/generation/attachment-media.ts";
import {
  getGeneratedImageAttachmentRoleChoices,
  type GeneratedImageDescriptor,
} from "../lib/generation/generated-image.ts";

export type GeneratedImageFileLoader = (
  image: GeneratedImageDescriptor,
) => Promise<File>;

export function useGeneratedImageAttachment({
  loadFile,
  selectedModel,
  setValue,
  value,
}: {
  loadFile: GeneratedImageFileLoader;
  selectedModel: PublishedGenerationModelSummary | null;
  setValue: Dispatch<SetStateAction<GenerationAttachmentMediaValue>>;
  value: GenerationAttachmentMediaValue;
}) {
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pendingKeysRef = useRef(new Set<string>());
  const selectedModelRef = useRef(selectedModel);
  const valueRef = useRef(value);

  selectedModelRef.current = selectedModel;
  valueRef.current = value;

  const getRoleChoices = useCallback(
    (image: GeneratedImageDescriptor) =>
      getGeneratedImageAttachmentRoleChoices({
        image,
        selectedModel: selectedModelRef.current,
        value: valueRef.current,
      }),
    [],
  );

  const isPending = useCallback(
    (image: GeneratedImageDescriptor, role: AttachmentMediaRole) =>
      pendingKeys.has(getPendingKey(image.jobId, role)),
    [pendingKeys],
  );

  const addGeneratedImage = useCallback(
    async (image: GeneratedImageDescriptor, role: AttachmentMediaRole) => {
      const pendingKey = getPendingKey(image.jobId, role);
      const initialModelId = selectedModelRef.current?.id ?? null;

      if (
        pendingKeysRef.current.has(pendingKey) ||
        !getRoleChoices(image).some(
          (choice) => choice.role === role && !choice.disabled,
        )
      ) {
        return;
      }

      pendingKeysRef.current.add(pendingKey);
      setPendingKeys(new Set(pendingKeysRef.current));

      try {
        const file = await loadFile(image);
        const currentModel = selectedModelRef.current;
        const loadedImage: GeneratedImageDescriptor = {
          ...image,
          contentLength: file.size,
          contentType: file.type || image.contentType,
        };
        const canStillAdd =
          currentModel?.id === initialModelId &&
          getGeneratedImageAttachmentRoleChoices({
            image: loadedImage,
            selectedModel: currentModel,
            value: valueRef.current,
          }).some((choice) => choice.role === role && !choice.disabled);

        if (!canStillAdd || !currentModel) {
          toast.error(
            "This image can no longer be added to the current generation.",
          );
          return;
        }

        const nextValue = appendAttachmentMediaFiles({
          fieldSpecs: getGenerationAttachmentMediaFieldSpecs(currentModel),
          files: [file],
          role,
          value: valueRef.current,
        });

        if (nextValue === valueRef.current) {
          toast.error("This image is not compatible with the current model.");
          return;
        }

        valueRef.current = nextValue;
        setValue(nextValue);
      } catch {
        toast.error("Unable to add the generated image.");
      } finally {
        pendingKeysRef.current.delete(pendingKey);
        setPendingKeys(new Set(pendingKeysRef.current));
      }
    },
    [getRoleChoices, loadFile, setValue],
  );

  return {
    addGeneratedImage,
    getRoleChoices,
    isPending,
  };
}

function getPendingKey(jobId: string, role: AttachmentMediaRole) {
  return `${jobId}:${role}`;
}
