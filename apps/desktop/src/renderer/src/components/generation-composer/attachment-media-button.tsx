import { FilePickerButton } from "@remora/ui";
import { PlusIcon } from "lucide-react";

import {
  getAttachmentMediaAccept,
  getAttachmentMediaFieldIdForFile,
  type AttachmentMediaFieldSpec,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";

export function AttachmentMediaButton({
  fieldSpecs,
  value,
  onValueChange,
}: {
  fieldSpecs: AttachmentMediaFieldSpec[];
  value: GenerationAttachmentMediaValue;
  onValueChange: (value: GenerationAttachmentMediaValue) => void;
}) {
  const pickerState = getAttachmentMediaPickerState(fieldSpecs, value);

  return (
    <FilePickerButton
      accept={pickerState.accept}
      aria-label="Add attachment"
      disabled={pickerState.disabled}
      multiple={pickerState.multiple}
      size="icon-xs"
      variant="ghost"
      className="text-secondary-foreground"
      onFilesSelect={(files) => {
        const nextValue = appendAttachmentMediaFiles({
          fieldSpecs,
          files,
          value,
        });

        if (nextValue !== value) {
          onValueChange(nextValue);
        }
      }}
    >
      <PlusIcon />
    </FilePickerButton>
  );
}

function getAttachmentMediaPickerState(
  fieldSpecs: AttachmentMediaFieldSpec[],
  value: GenerationAttachmentMediaValue,
) {
  const availableFieldSpecs = fieldSpecs.filter(
    (fieldSpec) => getRemainingAttachmentMediaCapacity(fieldSpec, value) > 0,
  );
  const hasUnboundedCapacity = availableFieldSpecs.some(
    (fieldSpec) => fieldSpec.arrayMax === undefined,
  );
  const finiteRemainingCapacity = availableFieldSpecs.reduce(
    (total, fieldSpec) =>
      total + getRemainingAttachmentMediaCapacity(fieldSpec, value),
    0,
  );

  return {
    accept: availableFieldSpecs.map(getAttachmentMediaAccept).join(","),
    disabled: availableFieldSpecs.length === 0,
    multiple: hasUnboundedCapacity || finiteRemainingCapacity > 1,
  };
}

function appendAttachmentMediaFiles({
  fieldSpecs,
  files,
  value,
}: {
  fieldSpecs: AttachmentMediaFieldSpec[];
  files: File[];
  value: GenerationAttachmentMediaValue;
}) {
  const fieldSpecById = new Map(
    fieldSpecs.map((fieldSpec) => [fieldSpec.id, fieldSpec]),
  );
  let nextValue = value;

  for (const file of files) {
    // A null route means no field accepts this file's format → gate it out.
    const fieldId = getAttachmentMediaFieldIdForFile(file, fieldSpecs);

    if (!fieldId) {
      continue;
    }

    const fieldSpec = fieldSpecById.get(fieldId);

    if (!fieldSpec) {
      continue;
    }

    if (getRemainingAttachmentMediaCapacity(fieldSpec, nextValue) <= 0) {
      continue;
    }

    nextValue = {
      ...nextValue,
      [fieldId]: [...nextValue[fieldId], file],
    };
  }

  return nextValue;
}

function getRemainingAttachmentMediaCapacity(
  fieldSpec: AttachmentMediaFieldSpec,
  value: GenerationAttachmentMediaValue,
) {
  if (fieldSpec.arrayMax === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(fieldSpec.arrayMax - value[fieldSpec.id].length, 0);
}
