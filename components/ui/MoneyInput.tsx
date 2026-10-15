"use client";

import { NumberInput } from "./NumberInput";

export interface MoneyInputProps {
  id: string;
  name: string;
  defaultValue?: number | string | null;
  required?: boolean;
  example?: string;
  [ariaProp: `aria-${string}`]: string | undefined;
}

// BR-CASH-005: Money is whole đồng, 15 digits at most.
export function MoneyInput({
  id,
  name,
  defaultValue,
  required,
  example,
  ...ariaProps
}: MoneyInputProps) {
  return (
    <NumberInput
      id={id}
      name={name}
      decimals={0}
      zeroIsEmpty
      defaultValue={defaultValue}
      required={required}
      example={example ?? "150,000"}
      {...ariaProps}
    />
  );
}
