"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/shared/format";
import { formatPercent, type PnlRow, type PnlTable } from "@/lib/reports/profit-and-loss-table";
import { PnlSourceList } from "./PnlSourceList";

// Computer layout (.claude/rules/ui-devices.md): a real table, months as
// columns (BR-PNL-002). Clicking a month cell opens what makes it up, under
// the table. The Tổng column never opens: a year of depreciation alone is
// 84 assets times the months. Row labels are <th>, which browsers bold by
// default and Tailwind's preflight does not reset, hence [font-weight:inherit].

const ROW_STYLE: Record<PnlRow["kind"], string> = {
  revenue: "font-semibold",
  detail: "text-xs text-text-secondary",
  cost: "",
  subtotal: "font-bold bg-surface-secondary",
  expense: "",
  income: "",
  net: "font-bold bg-surface-secondary",
  margin: "text-text-secondary",
  cumulative: "text-text-secondary",
};

function show(row: PnlRow, value: number | null): string {
  return row.unit === "percent" ? formatPercent(value) : formatNumber(value);
}
const tone = (value: number | null) => (value !== null && value < 0 ? "text-danger" : "");

export function PnlTableView({ table }: { table: PnlTable }) {
  const [selected, setSelected] = useState<{ rowKey: string; month: string } | null>(null);
  const selectedRow = selected ? table.rows.find(r => r.key === selected.rowKey) : undefined;
  const selectedCell = selected ? selectedRow?.cells.find(c => c.month === selected.month) : undefined;
  const selectedColumn = selected ? table.months.find(m => m.month === selected.month) : undefined;

  return (
    <section className="hidden md:block space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-text-primary">Từng tháng</h2>
        <p className="text-xs text-text-secondary">Đơn vị: đồng. Bấm vào một ô để xem các khoản làm nên ô đó.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface-card">
        <table className="min-w-full text-sm tabular-nums">
          <thead className="bg-surface-secondary text-xs text-text-secondary">
            <tr>
              <th scope="col" className="sticky left-0 bg-surface-secondary px-3 py-2 text-left font-medium">Khoản</th>
              {table.months.map(m => (
                <th key={m.month} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">{m.label}</th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-medium">Tổng</th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-medium">% doanh thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {table.rows.map(row => {
              const shaded = row.kind === "subtotal" || row.kind === "net";
              return (
                <tr key={row.key} className={ROW_STYLE[row.kind]}>
                  <th
                    scope="row"
                    className={`sticky left-0 whitespace-nowrap px-3 py-2 text-left [font-weight:inherit] ${shaded ? "bg-surface-secondary" : "bg-surface-card"} ${row.kind === "detail" ? "pl-6" : ""}`}
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell, i) => {
                    const clickable = cell.sources.length > 0 || cell.formula !== null;
                    const isSelected = selected?.rowKey === row.key && selected.month === cell.month;
                    const text = show(row, cell.value);
                    return (
                      <td key={cell.month} className={`px-1 py-1 text-right ${tone(cell.value)}`}>
                        {clickable ? (
                          <button
                            type="button"
                            aria-label={`${row.label} ${table.months[i].label}`}
                            aria-expanded={isSelected}
                            onClick={() => setSelected(isSelected ? null : { rowKey: row.key, month: cell.month })}
                            className={`w-full rounded px-2 py-1 text-right tabular-nums hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isSelected ? "bg-primary-soft ring-1 ring-primary" : ""}`}
                          >
                            {text}
                          </button>
                        ) : (
                          <span className="block px-2 py-1">{text}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`px-3 py-2 text-right font-semibold ${tone(row.total)}`}>
                    {row.total === null ? "" : show(row, row.total)}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
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
          className="space-y-2 rounded-xl border border-border bg-surface-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-text-primary">
              {selectedRow.label} · {selectedColumn.label}:{" "}
              <span className={tone(selectedCell.value)}>{show(selectedRow, selectedCell.value)}</span>
            </h3>
            <button type="button" onClick={() => setSelected(null)} className="text-sm font-bold text-primary hover:underline">
              Đóng
            </button>
          </div>
          {selectedCell.formula && <p className="text-sm text-text-secondary">{selectedCell.formula}</p>}
          {selectedCell.sources.length > 0 && <PnlSourceList sources={selectedCell.sources} />}
        </section>
      )}
    </section>
  );
}
