import { useRef, type ComponentPropsWithoutRef } from "react";

import { Button } from "../primitives/button.tsx";

type FilePickerButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "onChange" | "type"
> & {
  accept?: string;
  multiple?: boolean;
  onFilesSelect: (files: File[]) => void;
};

function FilePickerButton({
  accept,
  children,
  disabled,
  multiple = false,
  onClick,
  onFilesSelect,
  ...props
}: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleClick(event: Parameters<NonNullable<typeof onClick>>[0]) {
    onClick?.(event);

    if (event.defaultPrevented || disabled) {
      return;
    }

    inputRef.current?.click();
  }

  return (
    <>
      <Button {...props} disabled={disabled} type="button" onClick={handleClick}>
        {children}
      </Button>
      <input
        ref={inputRef}
        accept={accept}
        aria-hidden="true"
        className="sr-only"
        data-slot="file-picker-input"
        disabled={disabled}
        multiple={multiple}
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
    </>
  );
}

export { FilePickerButton };
