import { getProfitAndLossReport } from "./actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { YearPicker } from "./components/YearPicker";
import { PnlSummary } from "./components/PnlSummary";
import { PnlChart } from "./components/PnlChart";
import { PnlTableView } from "./components/PnlTableView";
import { PnlMonthCards } from "./components/PnlMonthCards";
import { PnlFootnotes } from "./components/PnlFootnotes";

export const dynamic = "force-dynamic";

// docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md. A malformed or
// data-less ?year= falls back to the newest year with data, without an error
// (plan, question 4): getProfitAndLossReport does the fallback.
export default async function ProfitAndLossPage({ searchParams }: { searchParams: { year?: string } }) {
  const raw = searchParams?.year;
  const requestedYear = raw && /^\d{4}$/.test(raw) ? Number(raw) : undefined;
  const { availableYears, table } = await getProfitAndLossReport(requestedYear);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">Lãi lỗ năm {table.year}</h1>
        <YearPicker years={availableYears} selected={table.year} />
      </div>
      {table.months.length === 0 ? (
        <EmptyState title={`Năm ${table.year} chưa có số liệu nào.`} />
      ) : (
        <>
          <PnlSummary table={table} />
          <PnlChart table={table} />
          <PnlTableView table={table} />
          <PnlMonthCards table={table} />
          <PnlFootnotes footnotes={table.footnotes} />
        </>
      )}
    </div>
  );
}
