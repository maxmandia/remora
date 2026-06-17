import { FilePickerButton } from "@remora/ui";
import { PlusIcon } from "lucide-react";

import {
  getReferenceMediaAccept,
  getReferenceMediaFieldIdForFile,
  type GenerationReferenceMediaValue,
  type ReferenceMediaFieldSpec,
} from "../../lib/generation/reference-media.ts";

export function ReferenceMediaButton({
  fieldSpecs,
  value,
  onValueChange,
}: {
  fieldSpecs: ReferenceMediaFieldSpec[];
  value: GenerationReferenceMediaValue;
  onValueChange: (value: GenerationReferenceMediaValue) => void;
}) {
  const pickerState = getReferenceMediaPickerState(fieldSpecs, value);

  return (
    <FilePickerButton
      accept={pickerState.accept}
      aria-label="Add reference"
      disabled={pickerState.disabled}
      multiple={pickerState.multiple}
      size="icon-xs"
      variant="ghost"
      className="text-secondary-foreground"
      onFilesSelect={(files) => {
        const nextValue = appendReferenceMediaFiles({
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

function getReferenceMediaPickerState(
  fieldSpecs: ReferenceMediaFieldSpec[],
  value: GenerationReferenceMediaValue,
) {
  const availableFieldSpecs = fieldSpecs.filter(
    (fieldSpec) => getRemainingReferenceMediaCapacity(fieldSpec, value) > 0,
  );
  const hasUnboundedCapacity = availableFieldSpecs.some(
    (fieldSpec) => fieldSpec.arrayMax === undefined,
  );
  const finiteRemainingCapacity = availableFieldSpecs.reduce(
    (total, fieldSpec) =>
      total + getRemainingReferenceMediaCapacity(fieldSpec, value),
    0,
  );

  return {
    accept: availableFieldSpecs.map(getReferenceMediaAccept).join(","),
    disabled: availableFieldSpecs.length === 0,
    multiple: hasUnboundedCapacity || finiteRemainingCapacity > 1,
  };
}

function appendReferenceMediaFiles({
  fieldSpecs,
  files,
  value,
}: {
  fieldSpecs: ReferenceMediaFieldSpec[];
  files: File[];
  value: GenerationReferenceMediaValue;
}) {
  const fieldSpecById = new Map(
    fieldSpecs.map((fieldSpec) => [fieldSpec.id, fieldSpec]),
  );
  let nextValue = value;

  for (const file of files) {
    // A null route means no field accepts this file's format → gate it out.
    const fieldId = getReferenceMediaFieldIdForFile(file, fieldSpecs);

    if (!fieldId) {
      continue;
    }

    const fieldSpec = fieldSpecById.get(fieldId);

    if (!fieldSpec) {
      continue;
    }

    if (getRemainingReferenceMediaCapacity(fieldSpec, nextValue) <= 0) {
      continue;
    }

    nextValue = {
      ...nextValue,
      [fieldId]: [...nextValue[fieldId], file],
    };
  }

  return nextValue;
}

function getRemainingReferenceMediaCapacity(
  fieldSpec: ReferenceMediaFieldSpec,
  value: GenerationReferenceMediaValue,
) {
  if (fieldSpec.arrayMax === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(fieldSpec.arrayMax - value[fieldSpec.id].length, 0);
}
