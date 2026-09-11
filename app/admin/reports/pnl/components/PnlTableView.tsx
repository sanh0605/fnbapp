"use client";

import { useState } from "react";
import { formatPercent, type PnlRow, type PnlTable } from "@/lib/reports/profit-and-loss-table";
import { cellText, cellTone, isCostRow, NoteMarks } from "./pnl-display";
import { PnlSourceList } from "./PnlSourceList";
import { PnlNotes } from "./PnlNotes";

// Computer layout (.claude/rules/ui-devices.md): a real table, months as
// columns (BR-PNL-002). Clicking a month cell opens what makes it up, under
// the table. The Tổng column never opens: a year of depreciation alone is
// 84 assets times the months. Row labels are <th>, which browsers bold by
// default and Tailwind's preflight does not reset, hence [font-weight:inherit].
// Panel look, sticky Tổng/% columns and cost-row minus signs follow the
// sample the owner approved 2026-09-11 (plan Mục 3).

const ROW_STYLE: Record<PnlRow["kind"], string> = {
  revenue: "font-semibold",
  detail: "text-[12.5px] text-text-secondary",
  cost: "",
  subtotal: "font-bold bg-surface-secondary",
  expense: "",
  income: "",
  net: "font-bold bg-surface-secondary",
  margin: "text-[12.5px] text-text-secondary",
  cumulative: "",
};

export function PnlTableView({ table }: { table: PnlTable }) {
  const [selected, setSelected] = useState<{ rowKey: string; month: string } | null>(null);
  const selectedRow = selected ? table.rows.find(r => r.key === selected.rowKey) : undefined;
  const selectedCell = selected ? selectedRow?.cells.find(c => c.month === selected.month) : undefined;
  const selectedColumn = selected ? table.months.find(m => m.month === selected.month) : undefined;

  return (
    <section className="hidden overflow-hidden rounded-xl border border-border bg-surface-card shadow-panel md:block">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-[18px] pb-[6px] pt-4">
        <h2 className="text-[17px] font-semibold text-text-primary">Bảng từng tháng</h2>
        <p className="text-xs text-text-secondary">
          Bấm vào một ô để xem số đó từ đâu ra. Đọc từ trên xuống: doanh thu → trừ giá vốn → lợi nhuận gộp → trừ chi phí → lợi nhuận ròng.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm tabular-nums">
          <thead className="bg-surface-secondary text-xs text-text-secondary">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface-secondary px-3 py-2 text-left font-medium">Khoản</th>
              {table.months.map(m => (
                <th key={m.month} scope="col" aria-label={m.label} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {m.head}
                  <NoteMarks numbers={m.notes} />
                  {m.until && <span className="block text-[11.5px] font-normal text-text-secondary">đến {m.until}</span>}
                </th>
              ))}
              <th scope="col" className="sticky right-24 z-10 border-l-2 border-border bg-surface-secondary px-3 py-2 text-right font-medium">Tổng</th>
              <th scope="col" className="sticky right-0 z-10 w-24 min-w-[6rem] whitespace-nowrap bg-surface-secondary px-3 py-2 text-right font-medium">% doanh thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {table.rows.map(row => {
              const shaded = row.kind === "subtotal" || row.kind === "net";
              const rowBg = shaded ? "bg-surface-secondary" : "bg-surface-card";
              return (
                <tr key={row.key} className={ROW_STYLE[row.kind]}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 whitespace-nowrap px-3 py-2 text-left [font-weight:inherit] ${rowBg} ${row.kind === "detail" ? "pl-6" : ""}`}
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell, i) => {
                    const clickable = cell.sources.length > 0 || cell.formula !== null;
                    const isSelected = selected?.rowKey === row.key && selected.month === cell.month;
                    const text = cellText(row, cell.value);
                    return (
                      <td key={cell.month} className={`px-1 py-1 text-right ${cellTone(row, cell.value)}`}>
                        {clickable ? (
                          <button
                            type="button"
                            aria-label={`${row.label} ${table.months[i].label}`}
                            aria-expanded={isSelected}
                            onClick={() => setSelected(isSelected ? null : { rowKey: row.key, month: cell.month })}
                            className={`w-full rounded px-2 py-1 text-right tabular-nums hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isSelected ? "outline outline-2 -outline-offset-2 outline-primary bg-primary-soft" : ""}`}
                          >
                            {text}
                          </button>
                        ) : (
                          <span className="block px-2 py-1">{text}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`sticky right-24 z-10 border-l-2 border-border px-3 py-2 text-right font-semibold ${rowBg} ${cellTone(row, row.total)}`}>
                    {row.total === null ? "" : cellText(row, row.total)}
                  </td>
                  <td className={`sticky right-0 z-10 w-24 min-w-[6rem] px-3 py-2 text-right text-text-secondary ${rowBg}`}>
                    {row.shareOfRevenue === null ? "" : formatPercent(row.shareOfRevenue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedRow && selectedCell && selectedColumn && (
        <section
          aria-label={`Chi tiết: ${selectedRow.label} ${selectedColumn.label}`}
          className="mx-4 mb-4 max-w-xl space-y-2 rounded-xl border border-border bg-surface-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-text-primary">
              {selectedRow.label} · {selectedColumn.label}:{" "}
              <span className={cellTone(selectedRow, selectedCell.value)}>{cellText(selectedRow, selectedCell.value)}</span>
            </h3>
            <button type="button" onClick={() => setSelected(null)} className="text-sm font-bold text-primary hover:underline">
              Đóng
            </button>
          </div>
          {selectedCell.formula && <p className="text-sm text-text-secondary">{selectedCell.formula}</p>}
          {selectedCell.sources.length > 0 && (
            <PnlSourceList sources={selectedCell.sources} negate={isCostRow(selectedRow)} />
          )}
        </section>
      )}
      <PnlNotes footnotes={table.footnotes} />
    </section>
  );
}
