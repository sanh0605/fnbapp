import React from "react";

export function Table({
  children,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  "aria-label"?: string;
}): JSX.Element {
  return (
    <div className="overflow-x-auto bg-surface-card border border-border rounded-card">
      <table className="w-full text-left text-sm border-collapse" aria-label={ariaLabel}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <thead>
      <tr className="bg-page border-b border-border">{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "right";
}): JSX.Element {
  return (
    <th
      className={`px-4 py-3 text-[13px] font-medium text-text-secondary ${
        align === "right" ? "text-right" : ""
      }`.trim()}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: React.ReactNode }): JSX.Element {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({ children }: { children: React.ReactNode }): JSX.Element {
  return <tr className="hover:bg-page/60">{children}</tr>;
}

export function TableCell({
  children,
  align,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "right";
  colSpan?: number;
}): JSX.Element {
  return (
    <td
      colSpan={colSpan}
      className={`px-4 py-3 text-sm font-normal text-text-primary ${
        align === "right" ? "text-right tabular-nums" : ""
      }`.trim()}
    >
      {children}
    </td>
  );
}

export function TableTotalRow({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <tbody>
      <tr className="bg-primary-soft">{children}</tr>
    </tbody>
  );
}

export function TotalCard({
  title,
  items,
  className = "",
}: {
  title?: string;
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}): JSX.Element {
  return (
    <div className={`bg-primary-soft rounded-card p-4 space-y-2 ${className}`.trim()}>
      {title && <div className="text-sm font-medium text-text-primary">{title}</div>}
      {items.map((item, index) => (
        <div key={index} className="flex justify-between items-center text-sm">
          <span className="text-text-secondary">{item.label}</span>
          <span className="text-text-primary tabular-nums font-normal">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
