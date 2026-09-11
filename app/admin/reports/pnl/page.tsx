import { getProfitAndLossReport } from "./actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { YearSelect } from "./components/YearSelect";
import { PnlSummary } from "./components/PnlSummary";
import { PnlChart } from "./components/PnlChart";
import { PnlTableView } from "./components/PnlTableView";
import { PnlMonthCards } from "./components/PnlMonthCards";
import { PnlFootnotes } from "./components/PnlFootnotes";

export const dynamic = "force-dynamic";

// "A và B" for two brands, "A, B và C" for more (plan, Mục 2 "Page header").
function joinBrandNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} và ${names[names.length - 1]}`;
}

// docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md. A malformed or
// data-less ?year= falls back to the newest year with data, without an error
// (plan, question 4): getProfitAndLossReport does the fallback.
export default async function ProfitAndLossPage({ searchParams }: { searchParams: { year?: string } }) {
  const raw = searchParams?.year;
  const requestedYear = raw && /^\d{4}$/.test(raw) ? Number(raw) : undefined;
  const { availableYears, table, brandNames } = await getProfitAndLossReport(requestedYear);
  const brandsText = joinBrandNames(brandNames);
  const subtitle = brandsText
    ? `Cả quán, gồm ${brandsText} · đơn vị: đồng · tháng theo giờ Việt Nam`
    : "Cả quán · đơn vị: đồng · tháng theo giờ Việt Nam";

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary md:text-[28px]">Báo cáo tài chính</h1>
          <p className="mt-1 text-[13px] text-text-secondary">{subtitle}</p>
        </div>
        <YearSelect years={availableYears} selected={table.year} />
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
