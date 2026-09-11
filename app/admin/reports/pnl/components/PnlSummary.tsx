import { formatNumber } from "@/lib/shared/format";
import { formatPercent, type PnlTable } from "@/lib/reports/profit-and-loss-table";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "success" | "danger" }) {
  const border = tone === "success" ? "border-success" : tone === "danger" ? "border-danger" : "border-border";
  const valueColor = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-text-primary";
  return (
    <div className={`rounded-xl border ${border} bg-surface-card px-4 py-3.5`}>
      <p className="text-xs font-medium uppercase tracking-[0.04em] text-text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-1 text-[12.5px] text-text-secondary">{sub}</p>
    </div>
  );
}

// The four figures of the sample (plan, "Bản thử, tóm tắt"). The worst month
// shows only when a month lost money. Best/worst months show their title as
// the big value and their amount as the sub-line, as in the sample.
export function PnlSummary({ table }: { table: PnlTable }) {
  const { summary, periodLabel, months } = table;
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const periodEnd = lastMonth ? (lastMonth.until ? `${lastMonth.until}/${table.year}` : lastMonth.title) : "";
  const netTone: "success" | "danger" = summary.netProfit < 0 ? "danger" : "success";
  const worstMonthNotes = summary.worstMonth
    ? months.find(m => m.month === summary.worstMonth!.month)?.notes ?? []
    : [];

  return (
    <section
      aria-label="Tóm tắt"
      className={`hidden gap-3 md:grid md:grid-cols-2 ${summary.worstMonth ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      <Tile
        label={`Doanh thu ${periodLabel}`}
        value={formatNumber(summary.revenue)}
        sub={firstMonth ? `từ ${firstMonth.title} đến ${periodEnd}` : ""}
      />
      <Tile
        label={`Lợi nhuận ròng ${periodLabel}`}
        value={formatNumber(summary.netProfit)}
        sub={summary.margin === null ? "chưa có doanh thu" : `biên ${formatPercent(summary.margin)} doanh thu`}
        tone={netTone}
      />
      <Tile
        label="Tháng lời nhất"
        value={summary.bestMonth ? summary.bestMonth.label : "---"}
        sub={summary.bestMonth ? formatNumber(summary.bestMonth.netProfit) : "Chưa có tháng nào lời"}
      />
      {summary.worstMonth && (
        <Tile
          label="Tháng lỗ nhất"
          value={summary.worstMonth.label}
          sub={
            worstMonthNotes.length > 0
              ? `${formatNumber(summary.worstMonth.netProfit)} · xem ghi chú ${worstMonthNotes.join(", ")}`
              : formatNumber(summary.worstMonth.netProfit)
          }
        />
      )}
    </section>
  );
}
