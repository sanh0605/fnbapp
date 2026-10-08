import React from "react";

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "style"> {
  invalid?: boolean;
  example?: string;
  keypad?: "digits";
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ invalid, example, keypad, placeholder, inputMode, type = "text", ...props }, ref) => {
    const computedPlaceholder = example !== undefined ? `Ví dụ: ${example}` : placeholder;
    const computedInputMode = keypad === "digits" ? "numeric" : inputMode;
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid ? "true" : props["aria-invalid"]}
        placeholder={computedPlaceholder}
        inputMode={computedInputMode}
        className={`w-full min-h-[44px] rounded-button bg-surface-card border ${
          invalid ? "border-danger" : "border-border"
        } px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30 disabled:opacity-50`}
        {...props}
      />
    );
  }
);

TextInput.displayName = "TextInput";
