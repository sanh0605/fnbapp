import React from "react";

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className" | "style"> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={invalid ? "true" : props["aria-invalid"]}
        className={`w-full min-h-[44px] md:min-h-[40px] rounded-button bg-surface-card border ${
          invalid ? "border-danger" : "border-border"
        } px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring/30 disabled:opacity-50`}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
