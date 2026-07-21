import type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@remora/ui";
import { PlusIcon } from "lucide-react";
import { useRef } from "react";

import {
  appendAttachmentMediaFiles,
  getAttachmentMediaAddAction,
  getAttachmentMediaRoleLabel,
  type AttachmentMediaFieldSpec,
  type AttachmentMediaRolePickerState,
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
  const inputRefs = useRef(new Map<AttachmentMediaRole, HTMLInputElement>());
  const addAction = getAttachmentMediaAddAction({ fieldSpecs, value });

  function setInputRef(role: AttachmentMediaRole) {
    return (input: HTMLInputElement | null) => {
      if (input) {
        inputRefs.current.set(role, input);
        return;
      }

      inputRefs.current.delete(role);
    };
  }

  function openFilePicker(role: AttachmentMediaRole) {
    inputRefs.current.get(role)?.click();
  }

  function handleFilesSelect(role: AttachmentMediaRole, files: File[]) {
    const nextValue = appendAttachmentMediaFiles({
      fieldSpecs,
      files,
      role,
      value,
    });

    if (nextValue !== value) {
      onValueChange(nextValue);
    }
  }

  if (addAction.kind === "dropdown") {
    return (
      <AttachmentMediaDropdownButton
        action={addAction}
        getInputRef={setInputRef}
        onFilesSelect={handleFilesSelect}
        onOpenFilePicker={openFilePicker}
      />
    );
  }

  return (
    <Button
      aria-label="Add attachment"
      className="text-secondary-foreground"
      disabled
      size="icon-xs"
      type="button"
      variant="ghost"
    >
      <PlusIcon />
    </Button>
  );
}

function AttachmentMediaDropdownButton({
  action,
  getInputRef,
  onFilesSelect,
  onOpenFilePicker,
}: {
  action: Extract<
    ReturnType<typeof getAttachmentMediaAddAction>,
    { kind: "dropdown" }
  >;
  getInputRef: (
    role: AttachmentMediaRole,
  ) => (input: HTMLInputElement | null) => void;
  onFilesSelect: (role: AttachmentMediaRole, files: File[]) => void;
  onOpenFilePicker: (role: AttachmentMediaRole) => void;
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Add attachment"
              className="text-secondary-foreground"
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <PlusIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="start" side="top">
          {action.choices.map((picker) => (
            <DropdownMenuItem
              key={picker.role}
              disabled={picker.disabled}
              onClick={() => {
                if (!picker.disabled) {
                  onOpenFilePicker(picker.role);
                }
              }}
            >
              {getAttachmentMediaRoleLabel(picker.role)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {action.choices.map((picker) => (
        <AttachmentMediaFileInput
          key={picker.role}
          inputRef={getInputRef(picker.role)}
          picker={picker}
          onFilesSelect={(files) => onFilesSelect(picker.role, files)}
        />
      ))}
    </>
  );
}

function AttachmentMediaFileInput({
  inputRef,
  picker,
  onFilesSelect,
}: {
  inputRef: (input: HTMLInputElement | null) => void;
  picker: AttachmentMediaRolePickerState;
  onFilesSelect: (files: File[]) => void;
}) {
  return (
    <input
      ref={inputRef}
      accept={picker.accept}
      aria-hidden="true"
      className="sr-only"
      data-attachment-media-role={picker.role}
      data-slot="file-picker-input"
      disabled={picker.disabled}
      multiple={picker.multiple}
      tabIndex={-1}
      type="file"
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);

        event.currentTarget.value = "";

        if (files.length > 0) {
          onFilesSelect(files);
        }
      }}
    />
  );
}
