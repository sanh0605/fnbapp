// Pure derived-column logic for the outlet breakdown table.
// docs/superpowers/plans/2026-08-25-outlet-breakdown-table.md section 2.
// Presentation only -- orders and revenue themselves are untouched, both
// already computed by app/admin/reports/actions.ts's getSalesDataV2. These
// two columns are new; extracted so the division-by-zero guards are
// directly testable without rendering anything.

// revenue / orders, rounded to whole đồng at display time via
// lib/format.ts's formatNumber. Null (not 0 or NaN) when there were no
// orders, so the caller renders "-" instead of a fabricated average.
export function avgPerOrder(revenue: number, orderCount: number): number | null {
  if (orderCount === 0) return null;
  return revenue / orderCount;
}

// This outlet's share of the period's total revenue, as a percentage
// (45.3, not 0.453). Null when the total is 0 -- nothing to be a share of.
export function percentOfTotal(revenue: number, totalRevenue: number): number | null {
  if (totalRevenue === 0) return null;
  return (revenue / totalRevenue) * 100;
}

const PERCENT_FORMATTER = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${PERCENT_FORMATTER.format(value)}%`;
}
