import React from "react";

export interface Field {
  label: string;
  value: React.ReactNode;
}

export interface FieldListProps {
  fields: Field[];
}

export function FieldList({ fields }: FieldListProps) {
  return (
    <div className="bg-surface-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
      {fields.map((field, idx) => {
        const isEmpty =
          field.value === null ||
          field.value === undefined ||
          field.value === "" ||
          (typeof field.value === "string" && field.value.trim() === "");

        return (
          <div
            key={idx}
            className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-1 md:gap-4 p-4"
          >
            <div className="text-sm text-text-muted font-medium md:text-text-secondary">
              {field.label}
            </div>
            <div className="text-base md:text-sm text-text-primary font-medium break-words">
              {isEmpty ? "—" : field.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
