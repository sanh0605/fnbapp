import { formatNumber } from "@/lib/shared/format";
import type { PnlTable } from "@/lib/reports/profit-and-loss-table";

// One bar per month, green for profit and red for loss, and a line for the
// running total since January (spec, "Biểu đồ"). One scale places bars,
// line and the zero line.
const SLOT = 64;
const BAR = 32;
const HEIGHT = 220;
const TOP = 16;
const BOTTOM = 28;

export function PnlChart({ table }: { table: PnlTable }) {
  const points = table.chart;
  if (points.length === 0) return null;
  const all = points.flatMap(p => [p.netProfit, p.cumulative]);
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const y = (v: number) => TOP + ((max - v) / span) * (HEIGHT - TOP - BOTTOM);
  const width = Math.max(points.length, 6) * SLOT;
  const offset = (width - points.length * SLOT) / 2;
  const cx = (i: number) => offset + i * SLOT + SLOT / 2;
  const zero = y(0);

  return (
    <section aria-label="Biểu đồ lãi lỗ" className="rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-success" />Tháng lời</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-danger" />Tháng lỗ</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-primary" />Cộng dồn từ đầu năm</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="mt-2 h-auto max-h-72 w-full"
        role="img"
        aria-label={`Lợi nhuận ròng từng tháng năm ${table.year} và cộng dồn từ đầu năm`}
      >
        <line x1={0} x2={width} y1={zero} y2={zero} className="stroke-border" strokeWidth={1} />
        <text x={4} y={zero - 4} fontSize={11} className="fill-text-muted">0</text>
        {points.map((p, i) => {
          const barTop = Math.min(y(p.netProfit), zero);
          const barHeight = p.netProfit === 0 ? 0 : Math.max(Math.abs(y(p.netProfit) - zero), 1);
          return (
            <g key={p.month}>
              <title>{`Tháng ${p.shortLabel}: lợi nhuận ròng ${formatNumber(p.netProfit)}, cộng dồn ${formatNumber(p.cumulative)}`}</title>
              <rect
                x={cx(i) - BAR / 2}
                y={barTop}
                width={BAR}
                height={barHeight}
                rx={3}
                className={p.netProfit < 0 ? "fill-danger" : "fill-success"}
              />
              <text x={cx(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={12} className="fill-text-secondary">
                {p.shortLabel}
              </text>
            </g>
          );
        })}
        <polyline
          points={points.map((p, i) => `${cx(i)},${y(p.cumulative)}`).join(" ")}
          fill="none"
          strokeWidth={2}
          className="stroke-primary"
        />
        {points.map((p, i) => (
          <circle key={p.month} cx={cx(i)} cy={y(p.cumulative)} r={3.5} className="fill-primary" />
        ))}
      </svg>
    </section>
  );
}
