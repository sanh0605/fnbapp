import { formatNumber } from "@/lib/shared/format";
import { formatPercent, type PnlTable } from "@/lib/reports/profit-and-loss-table";

function Tile({ label, value, note, negative }: { label: string; value: string; note: string; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums md:text-2xl ${negative ? "text-danger" : "text-text-primary"}`}>{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{note}</p>
    </div>
  );
}

// The four figures of the spec. The worst month shows only when a month lost money.
export function PnlSummary({ table }: { table: PnlTable }) {
  const { summary, periodLabel } = table;
  return (
    <section
      aria-label="Tóm tắt"
      className={`grid grid-cols-2 gap-3 ${summary.worstMonth ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      <Tile label={`Doanh thu ${periodLabel}`} value={formatNumber(summary.revenue)} note="Đơn vị: đồng" />
      <Tile
        label={`Lợi nhuận ròng ${periodLabel}`}
        value={formatNumber(summary.netProfit)}
        negative={summary.netProfit < 0}
        note={`Biên lợi nhuận ${formatPercent(summary.margin)}`}
      />
      <Tile
        label="Tháng lời nhất"
        value={summary.bestMonth ? formatNumber(summary.bestMonth.netProfit) : "---"}
        note={summary.bestMonth ? `Tháng ${summary.bestMonth.label}` : "Chưa có tháng nào lời"}
      />
      {summary.worstMonth && (
        <Tile
          label="Tháng lỗ nhất"
          value={formatNumber(summary.worstMonth.netProfit)}
          negative
          note={`Tháng ${summary.worstMonth.label}`}
        />
      )}
    </section>
  );
}
