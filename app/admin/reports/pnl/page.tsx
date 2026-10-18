import { getProfitAndLossReport } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangeUrlButton } from "@/components/ui/DateRangeUrlButton";
import { saigonToday, formatMonthLabel } from "@/lib/shared/datetime";
import { readMonthRangeParams } from "@/lib/shared/date-range-params";
import { PnlSummary } from "./components/PnlSummary";
import { PnlChart } from "./components/PnlChart";
import { PnlTableView } from "./components/PnlTableView";
import { PnlMonthCards } from "./components/PnlMonthCards";

export const dynamic = "force-dynamic";

// "A và B" for two brands, "A, B và C" for more (plan, Mục 2 "Page header").
function joinBrandNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} và ${names[names.length - 1]}`;
}

// docs/superpowers/specs/2026-10-09-bo-loc-thoi-gian-design.md.
// Lãi lỗ uses the shared Looker-style time filter in whole months (BR-UI-007),
// opening on Năm nay (January to this month) and supporting custom month spans.
export default async function ProfitAndLossPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const today = saigonToday();
  const range = readMonthRangeParams(searchParams ?? {}, today);
  const { table, brandNames } = await getProfitAndLossReport(range);
  const brandsText = joinBrandNames(brandNames);
  const subtitle = brandsText
    ? `Cả quán, gồm ${brandsText} · đơn\u00a0vị:\u00a0đồng · tháng theo giờ Việt Nam`
    : "Cả quán · đơn\u00a0vị:\u00a0đồng · tháng theo giờ Việt Nam";

  return (
    <div className="space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <PageHeader
        title="Lãi lỗ"
        subtitle={subtitle}
        actions={<DateRangeUrlButton mode="month" value={range} today={today} />}
      />
      {table.months.length === 0 ? (
        <EmptyState title={`Từ ${formatMonthLabel(range.start)} đến ${formatMonthLabel(range.end)} chưa có số liệu nào.`} />
      ) : (
        <>
          <PnlSummary table={table} />
          <PnlChart table={table} />
          <PnlTableView table={table} />
          <PnlMonthCards table={table} />
        </>
      )}
    </div>
  );
}
