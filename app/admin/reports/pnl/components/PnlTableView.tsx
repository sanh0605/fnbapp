"use client";

import { useState, useRef, useEffect } from "react";
import { formatPercent, type PnlRow, type PnlTable } from "@/lib/reports/profit-and-loss-table";
import { cellText, cellTone, isCostRow, NoteMarks } from "./pnl-display";
import { PnlSourceList } from "./PnlSourceList";
import { PnlNotes } from "./PnlNotes";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableRowHeader,
  TableCell,
  type TableRowLook,
} from "@/components/ui/Table";

// Computer layout (.claude/rules/ui-devices.md): a real table, months as
// columns (BR-PNL-002). Clicking a month cell opens what makes it up, under
// the table. The Tổng column never opens: a year of depreciation alone is
// 84 assets times the months. Row labels are <th>, which browsers bold by
// default and Tailwind's preflight does not reset, hence [font-weight:inherit].
// Panel look, sticky Tổng/% columns and cost-row minus signs follow the
// sample the owner approved 2026-09-11 (plan Mục 3).

function getRowLook(kind: PnlRow["kind"]): TableRowLook | undefined {
  if (kind === "revenue") return "strong";
  if (kind === "subtotal" || kind === "net") return "subtotal";
  if (kind === "detail" || kind === "margin") return "detail";
  return undefined;
}

export function PnlTableView({ table }: { table: PnlTable }) {
  const [selected, setSelected] = useState<{ rowKey: string; month: string } | null>(null);
  const selectedRow = selected ? table.rows.find(r => r.key === selected.rowKey) : undefined;
  const selectedCell = selected ? selectedRow?.cells.find(c => c.month === selected.month) : undefined;
  const selectedColumn = selected ? table.months.find(m => m.month === selected.month) : undefined;

  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const scrollContainer = sectionRef.current?.querySelector<HTMLElement>(".overflow-x-auto");
    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;
    }
  }, []);

  return (
    <section ref={sectionRef} className="hidden overflow-hidden rounded-xl border border-border bg-surface-card shadow-panel md:block">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-[18px] pb-[6px] pt-4">
        <h2 className="text-[17px] font-semibold text-text-primary">Bảng từng tháng</h2>
        <p className="text-xs text-text-secondary">
          Bấm vào một ô để xem số đó từ đâu ra. Đọc từ trên xuống: doanh thu → trừ giá vốn → lợi nhuận gộp → trừ chi phí → lợi nhuận ròng.
        </p>
      </div>
      <Table statement>
        <TableHead>
          <TableHeaderCell stick="left">Khoản</TableHeaderCell>
          {table.months.map(m => (
            <TableHeaderCell key={m.month} aria-label={m.label}>
              {m.head}
              <NoteMarks numbers={m.notes} />
              {m.until && <span className="block text-xs font-normal text-text-secondary">đến {m.until}</span>}
            </TableHeaderCell>
          ))}
          <TableHeaderCell stick="right-2">Tổng</TableHeaderCell>
          <TableHeaderCell stick="right">% doanh thu</TableHeaderCell>
        </TableHead>
        <TableBody>
          {table.rows.map(row => {
            const look = getRowLook(row.kind);
            return (
              <TableRow key={row.key} look={look}>
                <TableRowHeader stick="left" indent={row.kind === "detail"}>
                  {row.label}
                </TableRowHeader>
                {row.cells.map((cell, i) => {
                  const clickable = cell.sources.length > 0 || cell.formula !== null;
                  const isSelected = selected?.rowKey === row.key && selected.month === cell.month;
                  const text = cellText(row, cell.value);
                  const tone = cellTone(row, cell.value) === "text-danger" ? "negative" : undefined;
                  return (
                    <TableCell key={cell.month} align="right" tone={tone} tight>
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
                    </TableCell>
                  );
                })}
                <TableCell
                  align="right"
                  stick="right-2"
                  strong
                  tone={cellTone(row, row.total) === "text-danger" ? "negative" : undefined}
                >
                  {row.total === null ? "" : cellText(row, row.total)}
                </TableCell>
                <TableCell align="right" stick="right" tone="muted">
                  {row.shareOfRevenue === null ? "" : formatPercent(row.shareOfRevenue)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
      <PnlNotes footnotes={table.footnotes} hasAsterisk={table.chart.some(p => p.partial)} />
    </section>
  );
}
