"use client";

// Client component: a row hands its look to its cells through React context,
// which server components cannot create. Server pages still render it.
import React from "react";

export type TableRowLook = "subtotal" | "strong" | "detail";
export type TableStick = "left" | "right" | "right-2";
export type TableCellTone = "negative";

const TableRowContext = React.createContext<{ look?: TableRowLook }>({});

function getRowStickBg(look?: TableRowLook): string {
  return look === "subtotal" ? "bg-surface-secondary" : "bg-surface-card";
}

function getStickClasses(stick: TableStick | undefined, bg: string): string {
  if (!stick) return "";
  if (stick === "left") return `sticky left-0 z-10 ${bg}`;
  if (stick === "right-2") return `sticky right-24 z-10 border-l-2 border-border ${bg}`;
  if (stick === "right") return `sticky right-0 z-10 w-24 min-w-[6rem] ${bg}`;
  return "";
}

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
  stick,
  "aria-label": ariaLabel,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "right";
  stick?: TableStick;
  "aria-label"?: string;
  colSpan?: number;
}): JSX.Element {
  const stickClasses = getStickClasses(stick, "bg-page");
  const baseClasses = `px-4 py-3 text-[13px] font-medium text-text-secondary ${
    align === "right" ? "text-right" : ""
  }`.trim();

  const finalClasses = [baseClasses, stickClasses].filter(Boolean).join(" ");

  return (
    <th
      aria-label={ariaLabel}
      colSpan={colSpan}
      className={finalClasses}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: React.ReactNode }): JSX.Element {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({
  children,
  look,
}: {
  children: React.ReactNode;
  look?: TableRowLook;
}): JSX.Element {
  let rowClass = "hover:bg-page/60";
  if (look === "subtotal") {
    rowClass = "font-bold bg-surface-secondary";
  } else if (look === "strong") {
    rowClass = "font-semibold";
  } else if (look === "detail") {
    rowClass = "text-[12.5px] text-text-secondary";
  }

  return (
    <TableRowContext.Provider value={{ look }}>
      <tr className={rowClass}>{children}</tr>
    </TableRowContext.Provider>
  );
}

export function TableRowHeader({
  children,
  stick,
  indent,
  colSpan,
  className = "",
}: {
  children?: React.ReactNode;
  stick?: TableStick;
  indent?: boolean;
  colSpan?: number;
  className?: string;
}): JSX.Element {
  const { look } = React.useContext(TableRowContext);
  const stickBg = getRowStickBg(look);
  const stickClasses = getStickClasses(stick, stickBg);

  const baseClasses = [
    "px-3 py-2 text-left whitespace-nowrap [font-weight:inherit]",
    indent ? "pl-6" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const finalClasses = [baseClasses, stickClasses, className].filter(Boolean).join(" ");

  return (
    <th
      scope="row"
      colSpan={colSpan}
      className={finalClasses}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  align,
  colSpan,
  stick,
  tone,
}: {
  children?: React.ReactNode;
  align?: "right";
  colSpan?: number;
  stick?: TableStick;
  tone?: TableCellTone;
}): JSX.Element {
  const { look } = React.useContext(TableRowContext);
  const stickBg = getRowStickBg(look);
  const stickClasses = getStickClasses(stick, stickBg);

  // A plain row sets its cells' size, weight and colour; a styled row (look)
  // sets them on the <tr>, so its cells inherit them and only pad.
  const baseClasses = [
    look ? "px-3 py-2" : "px-4 py-3 text-sm font-normal",
    tone === "negative" ? "text-danger" : look ? "" : "text-text-primary",
    align === "right" ? "text-right tabular-nums" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const finalClasses = [baseClasses, stickClasses].filter(Boolean).join(" ");

  return (
    <td
      colSpan={colSpan}
      className={finalClasses}
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
