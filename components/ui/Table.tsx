"use client";

// Client component: a row hands its look to its cells through React context,
// which server components cannot create. Server pages still render it.
import React, { useEffect, useRef } from "react";

export type TableRowLook = "subtotal" | "strong" | "detail" | "total";
export type TableStick = "left" | "right" | "right-2";
export type TableCellTone = "negative" | "muted";

// statement: a P&L-style table inside its own framed panel (owner-approved
// sample 2026-09-11): no frame of its own, a grey header band, every row the
// same compact height. pinHead: a long list scrolls inside 528px with its
// column names in view.
const TableContext = React.createContext<{ statement?: boolean; pinHead?: boolean }>({});
const TableRowContext = React.createContext<{ look?: TableRowLook }>({});

function getRowStickBg(look?: TableRowLook): string {
  if (look === "total") return "bg-primary-soft";
  return look === "subtotal" ? "bg-surface-secondary" : "bg-surface-card";
}

// Dividers are inset shadows: in a border-collapse table a sticky cell's own
// border stays behind with the table when the columns scroll.
function getStickClasses(stick: TableStick | undefined, bg: string, zIndex = "z-10", statement = false): string {
  if (!stick) return "";
  if (stick === "left") return `sticky left-0 ${zIndex} ${bg}${statement ? " shadow-[inset_-2px_0_0_var(--color-border)]" : ""}`;
  if (stick === "right-2") return `sticky right-24 ${zIndex} shadow-[inset_2px_0_0_var(--color-border)] ${bg}`;
  if (stick === "right") return `sticky right-0 ${zIndex} w-24 min-w-[6rem] ${bg}`;
  return "";
}

export function Table({
  children,
  "aria-label": ariaLabel,
  statement,
  pinHead,
  openAtEnd,
}: {
  children: React.ReactNode;
  "aria-label"?: string;
  statement?: boolean;
  pinHead?: boolean;
  /** Statement only: open scrolled to the last columns (the newest months). */
  openAtEnd?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // A statement scrolls in whole columns: when the non-sticky columns do not
  // all fit, each gets one width so a whole number of them fills the room the
  // sticky columns leave, and the box stops on a column edge. A half-hidden
  // "1,857,000" reads "57,000". Re-measured on resize and when the header
  // cells change (another date range re-renders without remounting).
  useEffect(() => {
    const scroller = scrollRef.current;
    const head = scroller?.querySelector("thead");
    if (!statement || !scroller || !head) return;
    let toEnd = openAtEnd;
    let box = 0; // box width at the last fit: where "at the newest months" was
    const fit = () => {
      // Hidden: the browser may reset the scroll, so open at the newest months when shown again.
      if (scroller.clientWidth === 0) { toEnd = openAtEnd; return; }
      const left = scroller.scrollLeft;
      const heads = Array.from(head.querySelectorAll<HTMLElement>("th"));
      const stuck = heads.filter(th => th.classList.contains("sticky"));
      const cols = heads.filter(th => !th.classList.contains("sticky"));
      // The month the owner scrolled to, counted in the old width.
      const step = parseFloat(cols[0]?.style.width ?? "") || 0;
      const atEnd = step > 0 && left >= scroller.scrollWidth - Math.max(box + step / 2, scroller.clientWidth + 1);
      box = scroller.clientWidth;
      cols.forEach(th => { th.style.width = ""; th.style.minWidth = ""; th.style.scrollSnapAlign = ""; });
      scroller.style.scrollSnapType = "";
      if (cols.length > 0 && scroller.scrollWidth > scroller.clientWidth) {
        const widthOf = (th: HTMLElement) => th.getBoundingClientRect().width;
        const sum = (ths: HTMLElement[]) => ths.reduce((total, th) => total + widthOf(th), 0);
        const room = scroller.clientWidth - sum(stuck);
        const widest = Math.max(...cols.map(widthOf));
        const w = Math.max(widest, room / Math.max(1, Math.floor(room / widest)));
        const place = step ? Math.round(left / step) * w : left;
        const width = `${w}px`;
        cols.forEach(th => { th.style.width = width; th.style.minWidth = width; th.style.scrollSnapAlign = "start"; });
        scroller.style.scrollPaddingLeft = `${sum(stuck.filter(th => th.classList.contains("left-0")))}px`;
        scroller.style.scrollSnapType = "x mandatory";
        // The newest months on first show, after another range, and when the owner was already at them; otherwise stay on the month the owner scrolled to.
        scroller.scrollLeft = toEnd || atEnd ? scroller.scrollWidth : place;
        toEnd = false;
      } else toEnd = openAtEnd;
    };
    fit();
    const mo = new MutationObserver(() => { toEnd = openAtEnd; fit(); });
    mo.observe(head, { childList: true, subtree: true, characterData: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    ro?.observe(scroller);
    const table = scroller.querySelector("table");
    if (table) ro?.observe(table);
    return () => { mo.disconnect(); ro?.disconnect(); };
  }, [statement, openAtEnd]);

  const frame = statement ? "overflow-x-auto" : "overflow-x-auto bg-surface-card border border-border rounded-card";
  const scroll = pinHead ? "max-h-[528px] overflow-y-auto" : "";
  return (
    <TableContext.Provider value={{ statement, pinHead }}>
      <div ref={scrollRef} className={[frame, scroll].filter(Boolean).join(" ")}>
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
  const zIndex = pinHead && stick === "left" ? "z-20" : "z-10";
  const stickClasses = getStickClasses(stick, headBg, zIndex, statement);
  const baseClasses = [
    // BR-UI-011: every title is bold and on the left, an amount column's
    // too; its figures stay right in the body cells.
    statement
      ? "px-3 py-2 whitespace-nowrap text-left font-semibold text-text-secondary"
      : "px-3 py-2 md:px-4 md:py-3 whitespace-nowrap md:whitespace-normal text-[13px] text-left font-semibold text-text-secondary",
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
  const { statement } = React.useContext(TableContext);
  const { look } = React.useContext(TableRowContext);
  const stickBg = getRowStickBg(look);
  const stickClasses = getStickClasses(stick, stickBg, "z-10", statement);

  const pad = statement
    ? "px-3 py-2 whitespace-nowrap"
    : "px-3 py-2 md:px-4 md:py-3 whitespace-nowrap md:whitespace-normal";

  const baseClasses = [
    pad,
    "text-left [font-weight:inherit]",
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
  const stickClasses = getStickClasses(stick, stickBg, "z-10", statement);

  // A plain list row sets its cells' size, weight and colour; a styled row
  // (look) or any statement row sets them on the <tr>, so its cells inherit
  // them and only pad.
  const inherit = Boolean(statement) || (Boolean(look) && look !== "total");
  const pad = statement && tight ? "px-1 py-1" : inherit ? "px-3 py-2" : "px-3 py-2 md:px-4 md:py-3 text-sm font-normal";
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
    <TableRowContext.Provider value={{ look: "total" }}>
      <tbody>
        <tr className="bg-primary-soft">{children}</tr>
      </tbody>
    </TableRowContext.Provider>
  );
}
