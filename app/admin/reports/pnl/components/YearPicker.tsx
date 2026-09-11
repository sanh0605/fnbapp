import Link from "next/link";

// Only years with data are offered (spec, "Trên cùng"). One year: nothing to pick.
export function YearPicker({ years, selected }: { years: number[]; selected: number }) {
  if (years.length <= 1) return null;
  return (
    <nav aria-label="Chọn năm" className="flex flex-wrap gap-2">
      {years.map(year => (
        <Link
          key={year}
          href={`/admin/reports/pnl?year=${year}`}
          aria-current={year === selected ? "page" : undefined}
          className={`flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-bold ${
            year === selected ? "border-primary bg-primary text-white" : "border-border bg-surface-card text-text-secondary hover:text-text-primary"
          }`}
        >
          {year}
        </Link>
      ))}
    </nav>
  );
}
