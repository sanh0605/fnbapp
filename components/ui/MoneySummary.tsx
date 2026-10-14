import React from "react";

export interface MoneySummaryLine {
  label: string;
  value: React.ReactNode;
}

export interface MoneySummaryProps {
  lines: MoneySummaryLine[];
  total: {
    label: string;
    value: React.ReactNode;
  };
}

export function MoneySummary({ lines, total }: MoneySummaryProps): JSX.Element {
  return (
    <div className="bg-surface-card border border-border rounded-card p-4 space-y-2">
      {lines.map((line, index) => (
        <div key={index} className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">{line.label}</span>
          <span className="text-sm text-text-primary tabular-nums text-right">{line.value}</span>
        </div>
      ))}
      <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
        <span className="text-sm font-medium text-text-primary">{total.label}</span>
        <span className="text-base font-semibold text-text-primary tabular-nums text-right">
          {total.value}
        </span>
      </div>
    </div>
  );
}
