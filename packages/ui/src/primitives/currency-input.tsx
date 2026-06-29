import type { ChangeEvent, ComponentPropsWithoutRef } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "./input-group.tsx";

const currencyInputValuePattern = /^(?:\d+|\d+\.\d{0,2})?$/;

export type CurrencyInputProps = Omit<
  ComponentPropsWithoutRef<typeof InputGroupInput>,
  | "children"
  | "className"
  | "defaultValue"
  | "inputMode"
  | "onChange"
  | "type"
  | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
};

function CurrencyInput({
  className,
  inputClassName,
  value,
  onValueChange,
  ...props
}: CurrencyInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = resolveCurrencyInputValue(value, event.target.value);

    if (nextValue !== value) {
      onValueChange(nextValue);
    }
  }

  return (
    <InputGroup className={className}>
      {value ? (
        <InputGroupAddon align="inline-start">
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
      ) : null}
      <InputGroupInput
        {...props}
        className={inputClassName}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
      />
    </InputGroup>
  );
}

export function resolveCurrencyInputValue(
  previousValue: string,
  nextValue: string,
) {
  return currencyInputValuePattern.test(nextValue) ? nextValue : previousValue;
}

export { CurrencyInput };
