import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from "@remora/ui";
import type { ChangeEvent, ComponentPropsWithoutRef } from "react";

export type FormFieldError = {
  message: string;
};

export type FormFieldA11y = {
  errors: FormFieldError[];
  isInvalid: boolean;
  errorId: string | undefined;
  descriptionId: string | undefined;
  describedBy: string | undefined;
};

export type FormTextFieldProps = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  | "aria-describedby"
  | "aria-invalid"
  | "children"
  | "id"
  | "name"
  | "onChange"
  | "value"
> & {
  id: string;
  name?: string;
  label: string;
  value: string;
  errors: readonly unknown[];
  description?: string;
  onBlur: () => void;
  onChange: (value: string) => void;
};

export function getFormFieldErrors(
  errors: readonly unknown[],
): FormFieldError[] {
  return errors
    .map((error) => {
      if (typeof error === "string" && error.trim()) {
        return { message: error };
      }

      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.trim()
      ) {
        return { message: error.message };
      }

      return undefined;
    })
    .filter((error): error is FormFieldError => Boolean(error));
}

export function getFormFieldA11y({
  id,
  errors,
  description,
}: {
  id: string;
  errors: readonly unknown[];
  description?: string;
}): FormFieldA11y {
  const fieldErrors = getFormFieldErrors(errors);
  const isInvalid = fieldErrors.length > 0;
  const errorId = isInvalid ? `${id}-error` : undefined;
  const descriptionId =
    description && !isInvalid ? `${id}-description` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");

  return {
    errors: fieldErrors,
    isInvalid,
    errorId,
    descriptionId,
    describedBy: describedBy || undefined,
  };
}

export function FormTextField({
  id,
  name = id,
  label,
  type = "text",
  value,
  errors,
  description,
  inputMode,
  onBlur,
  onChange,
  ...props
}: FormTextFieldProps) {
  const field = getFormFieldA11y({ id, errors, description });
  const isEmailField = type === "email" || inputMode === "email";

  return (
    <Field data-invalid={field.isInvalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        {...props}
        id={id}
        name={name}
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        autoCapitalize={isEmailField ? "none" : props.autoCapitalize}
        inputMode={inputMode}
        spellCheck={isEmailField ? false : props.spellCheck}
        aria-invalid={field.isInvalid}
        aria-describedby={field.describedBy}
      />
      {description && !field.isInvalid ? (
        <FieldDescription id={field.descriptionId}>
          {description}
        </FieldDescription>
      ) : null}
      <FieldError id={field.errorId} errors={field.errors} />
    </Field>
  );
}
