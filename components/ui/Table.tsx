"use client";

// Client component: a row hands its look to its cells through React context,
// which server components cannot create. Server pages still render it.
import React from "react";

export type TableRowLook = "subtotal" | "strong" | "detail";
export type TableStick = "left" | "right" | "right-2";
export type TableCellTone = "negative" | "muted";

// statement: a P&L-style table inside its own framed panel (owner-approved
// sample 2026-09-11): no frame of its own, a grey header band, every row the
// same compact height. pinHead: a long list scrolls inside 528px with its
// column names in view.
const TableContext = React.createContext<{ statement?: boolean; pinHead?: boolean }>({});
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
  statement,
  pinHead,
}: {
  children: React.ReactNode;
  "aria-label"?: string;
  statement?: boolean;
  pinHead?: boolean;
}) {
  const frame = statement ? "overflow-x-auto" : "overflow-x-auto bg-surface-card border border-border rounded-card";
  const scroll = pinHead ? "max-h-[528px] overflow-y-auto" : "";
  return (
    <TableContext.Provider value={{ statement, pinHead }}>
      <div className={[frame, scroll].filter(Boolean).join(" ")}>
        <table className="w-full text-left text-sm border-collapse" aria-label={ariaLabel}>
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  const { statement } = React.useContext(TableContext);
  const band = statement
    ? "bg-surface-secondary text-xs text-text-secondary"
    : "bg-page border-b border-border";
  return (
    <thead>
      <tr className={band}>{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({
  children,
  stick,
  "aria-label": ariaLabel,
  colSpan,
}: {
  children?: React.ReactNode;
  stick?: TableStick;
  "aria-label"?: string;
  colSpan?: number;
}) {
  const { statement, pinHead } = React.useContext(TableContext);
  const headBg = statement ? "bg-surface-secondary" : "bg-page";
  const stickClasses = getStickClasses(stick, headBg);
  const baseClasses = [
    // BR-UI-011: every title is bold and on the left, an amount column's
    // too; its figures stay right in the body cells.
    statement
      ? "px-3 py-2 whitespace-nowrap text-left font-semibold text-text-secondary"
      : "px-4 py-3 text-[13px] text-left font-semibold text-text-secondary",
  ]
    .filter(Boolean)
    .join(" ");
  // A pinned head sits above the rows it covers; a cell that also sticks
  // sideways already carries its own background and z-index.
  const pinClasses = pinHead ? `sticky top-0 ${stick ? "" : `z-10 ${headBg}`}`.trim() : "";

  const finalClasses = [baseClasses, stickClasses, pinClasses].filter(Boolean).join(" ");

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

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({
  children,
  look,
}: {
  children: React.ReactNode;
  look?: TableRowLook;
}) {
  const { statement } = React.useContext(TableContext);
  let rowClass = statement ? "" : "hover:bg-page/60";
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
}) {
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
  tight,
  strong,
}: {
  children?: React.ReactNode;
  align?: "right";
  colSpan?: number;
  stick?: TableStick;
  tone?: TableCellTone;
  /** Statement only: a cell holding its own padded button (a P&L month). */
  tight?: boolean;
  /** Statement only: the Tổng column. List rows stay normal weight (BR-UI-003). */
  strong?: boolean;
}) {
  const { statement } = React.useContext(TableContext);
  const { look } = React.useContext(TableRowContext);
  const stickBg = getRowStickBg(look);
  const stickClasses = getStickClasses(stick, stickBg);

  // A plain list row sets its cells' size, weight and colour; a styled row
  // (look) or any statement row sets them on the <tr>, so its cells inherit
  // them and only pad.
  const inherit = Boolean(look) || Boolean(statement);
  const pad = statement && tight ? "px-1 py-1" : inherit ? "px-3 py-2" : "px-4 py-3 text-sm font-normal";
  const colour =
    tone === "negative" ? "text-danger" : tone === "muted" ? "text-text-secondary" : inherit ? "" : "text-text-primary";
  const baseClasses = [
    pad,
    colour,
    statement && strong ? "font-semibold" : "",
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

export function TableTotalRow({ children }: { children: React.ReactNode }) {
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
}) {
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
