import React from "react";

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "style"> {
  invalid?: boolean;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid ? "true" : props["aria-invalid"]}
        className={`w-full min-h-[44px] rounded-button bg-surface-card border ${
          invalid ? "border-danger" : "border-border"
        } px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30 disabled:opacity-50`}
        {...props}
      />
    );
  }
);

TextInput.displayName = "TextInput";
