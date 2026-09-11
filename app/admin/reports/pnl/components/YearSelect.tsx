"use client";

import { useRouter } from "next/navigation";

// Always shown, even with one year (owner note "title này đang là hardcode"):
// the year was never fixed, it just looked that way because the old buttons
// hid entirely when there was nothing to pick between.
export function YearSelect({ years, selected }: { years: number[]; selected: number }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-1">
      <label htmlFor="pnl-year" className="text-xs font-medium uppercase tracking-[0.04em] text-text-muted">
        Năm
      </label>
      <select
        id="pnl-year"
        value={selected}
        onChange={e => router.push(`/admin/reports/pnl?year=${e.target.value}`)}
        className="min-h-[44px] rounded-lg border border-border bg-surface-card px-3 py-2 text-sm font-bold text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {years.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
  );
}
