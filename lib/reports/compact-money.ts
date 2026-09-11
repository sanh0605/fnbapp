// Chart money, shortened to "k" (thousand) or "tr" (million).
// Owner decision 2026-09-12 (BR-DATA-005, docs/02-rules/business-rules/
// data-integrity.md): "hiển thị có đơn vị là k, triệu thì đơn vị là tr".
// One chart uses one unit for every figure it draws.
//
// orphan-allow: built in Mục 1 of
// docs/superpowers/plans/2026-09-12-bao-cao-tai-chinh-giao-dien.md; PnlChart.tsx
// (Mục 2, a separate reviewed step) is the first caller.

export type CompactUnit = "k" | "tr";

const MILLION = 1_000_000;
const THOUSAND = 1_000;

const COMPACT_FORMATTER = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

// tr when at least half of the months with a non-zero net profit are a
// million or more in size; otherwise k.
export function pickCompactUnit(values: number[]): CompactUnit {
  const nonZero = values.filter(v => Math.abs(v) >= 0.5).length;
  if (nonZero === 0) return "k";
  const million = values.filter(v => Math.abs(v) >= MILLION).length;
  return million * 2 >= nonZero ? "tr" : "k";
}

export function formatCompact(value: number, unit: CompactUnit): string {
  const divisor = unit === "tr" ? MILLION : THOUSAND;
  const formatted = COMPACT_FORMATTER.format(value / divisor);
  if (formatted === "0" || formatted === "-0") return "0";
  return `${formatted}${unit}`;
}
