import { formatNumber } from "@/lib/shared/format";
import { formatCompact, pickCompactUnit } from "@/lib/reports/compact-money";
import type { PnlTable } from "@/lib/reports/profit-and-loss-table";

// One bar per month, green for profit and red for loss, and a line for the
// running total since January (spec, "Biểu đồ"; plan "Bản thử, tóm tắt").
// One scale places the bars, the line, the ticks and the labels. Money drawn
// on the chart is shortened to k/tr, one unit for the whole chart
// (BR-DATA-005, lib/reports/compact-money.ts).
const VIEW_WIDTH = 760;
const VIEW_HEIGHT = 280;
const MARGIN = { left: 56, right: 18, top: 18, bottom: 34 };
const STEP_MULTIPLIERS = [1, 2, 2.5, 5];

// Smallest of {1, 2, 2.5, 5} x 10^n at or above rawStep.
function niceStep(rawStep: number): number {
  const target = Math.max(rawStep, 1);
  let exponent = Math.floor(Math.log10(target)) - 1;
  for (;;) {
    for (const m of STEP_MULTIPLIERS) {
      const candidate = m * 10 ** exponent;
      if (candidate >= target - 1e-6) return candidate;
    }
    exponent++;
  }
}

export function PnlChart({ table }: { table: PnlTable }) {
  const points = table.chart;
  if (points.length === 0) return null;

  const unit = pickCompactUnit(points.map(p => p.netProfit));

  const domainValues = points.flatMap(p => [p.netProfit, p.cumulative]).concat(0);
  const rawMax = Math.max(...domainValues);
  const rawMin = Math.min(...domainValues);
  const step = niceStep((rawMax - rawMin) / 6);
  const tickMin = Math.floor(rawMin / step) * step;
  const tickMax = Math.ceil(rawMax / step) * step;
  const tickCount = Math.round((tickMax - tickMin) / step);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => tickMin + i * step);

  const plotWidth = VIEW_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = VIEW_HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = plotWidth / points.length;
  const barWidth = Math.min(40, band * 0.46);

  const y = (v: number) => MARGIN.top + ((tickMax - v) / (tickMax - tickMin)) * plotHeight;
  const cx = (i: number) => MARGIN.left + band * (i + 0.5);
  const zeroY = y(0);
  const lastIndex = points.length - 1;

  return (
    <section className="hidden rounded-xl border border-border bg-surface-card shadow-panel md:block">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-[18px] pb-[6px] pt-4">
        <h2 className="text-[17px] font-semibold text-text-primary">Lãi lỗ từng tháng và luỹ kế</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-chart-profit" />Tháng lời
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-danger" />Tháng lỗ
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-success" />Luỹ kế
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="h-auto w-full px-2 pb-3"
        role="img"
        aria-label={`Lợi nhuận ròng từng tháng năm ${table.year} và luỹ kế`}
      >
        {ticks.map(tick => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={VIEW_WIDTH - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              className={tick === 0 ? "stroke-text-secondary" : "stroke-border"}
              strokeWidth={tick === 0 ? 1.2 : 1}
            />
            <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} className="fill-text-muted">
              {formatCompact(tick, unit)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const barTop = Math.min(y(p.netProfit), zeroY);
          const barHeight = p.netProfit === 0 ? 0 : Math.max(Math.abs(y(p.netProfit) - zeroY), 1);
          const isLoss = p.netProfit < 0;
          return (
            <g key={p.month}>
              <title>{`Tháng ${p.shortLabel}: lợi nhuận ròng ${formatNumber(p.netProfit)}, luỹ kế ${formatNumber(p.cumulative)}`}</title>
              <rect
                x={cx(i) - barWidth / 2}
                y={barTop}
                width={barWidth}
                height={barHeight}
                rx={3}
                className={isLoss ? "fill-danger" : "fill-chart-profit"}
              />
              {p.netProfit !== 0 && (
                <text
                  x={cx(i)}
                  y={isLoss ? barTop + barHeight + 13 : barTop - 5}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  className={isLoss ? "fill-danger" : "fill-success"}
                >
                  {formatCompact(p.netProfit, unit)}
                </text>
              )}
              <text
                x={cx(i)}
                y={VIEW_HEIGHT - MARGIN.bottom + 16}
                textAnchor="middle"
                fontSize={11.5}
                className="fill-text-secondary"
              >
                {p.head}{p.partial ? "*" : ""}
              </text>
            </g>
          );
        })}
        <polyline
          points={points.map((p, i) => `${cx(i)},${y(p.cumulative)}`).join(" ")}
          fill="none"
          strokeWidth={2.5}
          className="stroke-success"
        />
        {points.map((p, i) => (
          <circle
            key={p.month}
            cx={cx(i)}
            cy={y(p.cumulative)}
            r={i === lastIndex ? 5 : 3.2}
            strokeWidth={2}
            className="fill-surface-card stroke-success"
          />
        ))}
        <text
          x={cx(lastIndex) - 10}
          y={y(points[lastIndex].cumulative) - 10}
          textAnchor="end"
          fontSize={12}
          fontWeight={700}
          className="fill-success"
        >
          {`luỹ kế ${formatCompact(points[lastIndex].cumulative, unit)}`}
        </text>
      </svg>
    </section>
  );
}
