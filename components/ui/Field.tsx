import React from "react";

export function fieldMessageId(htmlFor: string): string {
  return `${htmlFor}-message`;
}

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text-primary mb-1">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={fieldMessageId(htmlFor)} role="alert" className="text-[13px] text-danger mt-1">
          {error}
        </p>
      ) : hint ? (
        <p id={fieldMessageId(htmlFor)} className="text-[13px] text-text-secondary mt-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
