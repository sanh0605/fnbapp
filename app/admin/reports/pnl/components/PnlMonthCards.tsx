import { formatNumber } from "@/lib/shared/format";
import { formatPercent, type PnlRow, type PnlTable } from "@/lib/reports/profit-and-loss-table";
import { PnlSourceList } from "./PnlSourceList";

// Phone layout (.claude/rules/ui-devices.md): no wide table. A card for the
// year, then one card per month, newest first. Native <details>, so no
// client component. A line opens only if it has sources or a formula (the
// same rule as the computer table).

const show = (row: PnlRow, value: number | null) => (row.unit === "percent" ? formatPercent(value) : formatNumber(value));
const tone = (value: number | null) => (value !== null && value < 0 ? "text-danger" : "text-text-primary");
const strong = (row: PnlRow) => row.kind === "revenue" || row.kind === "subtotal" || row.kind === "net";

function LineText({ row, value }: { row: PnlRow; value: number | null }) {
  return (
    <>
      <span className={`min-w-0 ${row.kind === "detail" ? "pl-3 text-xs text-text-secondary" : "text-text-primary"} ${strong(row) ? "font-bold" : ""}`}>
        {row.label}
      </span>
      <span className={`shrink-0 tabular-nums ${tone(value)} ${strong(row) ? "font-bold" : ""}`}>{show(row, value)}</span>
    </>
  );
}

function YearCard({ table }: { table: PnlTable }) {
  const net = table.rows.find(r => r.key === "netProfit")!;
  const lines = table.rows.filter(r => r.total !== null);
  const title = table.periodLabel === "cả năm" ? `Cả năm ${table.year}` : "Từ đầu năm";
  return (
    <details data-testid="pnl-year" open className="rounded-xl border border-border bg-surface-card">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-4 py-3">
        <span className="font-bold text-text-primary">{title}</span>
        <span className={`font-bold tabular-nums ${tone(net.total)}`}>{formatNumber(net.total)}</span>
      </summary>
      <div className="divide-y divide-border border-t border-border px-4">
        {lines.map(row => (
          <div key={row.key} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <LineText row={row} value={row.total} />
          </div>
        ))}
      </div>
    </details>
  );
}

function MonthCard({ table, index }: { table: PnlTable; index: number }) {
  const column = table.months[index];
  const net = table.rows.find(r => r.key === "netProfit")!.cells[index];
  const revenue = table.rows.find(r => r.key === "revenue")!.cells[index];
  return (
    <details data-testid={`pnl-month-${column.month}`} className="rounded-xl border border-border bg-surface-card">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="block font-bold text-text-primary">{column.label}</span>
          <span className="block text-xs text-text-secondary">Doanh thu {formatNumber(revenue.value)}</span>
        </span>
        <span className={`font-bold tabular-nums ${tone(net.value)}`}>{formatNumber(net.value)}</span>
      </summary>
      <div className="divide-y divide-border border-t border-border px-4">
        {table.rows.map(row => {
          const cell = row.cells[index];
          const opens = cell.sources.length > 0 || cell.formula !== null;
          if (!opens) {
            return (
              <div key={row.key} data-testid={`pnl-line-${row.key}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <LineText row={row} value={cell.value} />
              </div>
            );
          }
          return (
            <details key={row.key} data-testid={`pnl-line-${row.key}`} className="py-1 text-sm">
              <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
                <LineText row={row} value={cell.value} />
              </summary>
              <div className="space-y-2 pb-2 pl-3">
                {cell.formula && <p className="text-xs text-text-secondary">{cell.formula}</p>}
                {cell.sources.length > 0 && <PnlSourceList sources={cell.sources} />}
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}

export function PnlMonthCards({ table }: { table: PnlTable }) {
  const newestFirst = table.months.map((_, i) => i).reverse();
  return (
    <section aria-label="Từng tháng" className="space-y-3 md:hidden">
      <p className="text-xs text-text-secondary">Đơn vị: đồng. Bấm vào một tháng để xem từng khoản.</p>
      <YearCard table={table} />
      {newestFirst.map(i => (
        <MonthCard key={table.months[i].month} table={table} index={i} />
      ))}
    </section>
  );
}
