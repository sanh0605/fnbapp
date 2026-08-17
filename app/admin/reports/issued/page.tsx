import Link from "next/link";
import { getIssuedValueReport } from "./actions";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { ItemCard } from "./ItemCard";

export const dynamic = "force-dynamic";

type Tab = "items" | "events" | "months";

function tabHref(tab: Tab): string {
  return `/admin/reports/issued?tab=${tab}`;
}

// Plan G section 1 / G5: all issued value to date falls in the month the
// first stocktake closed, not the month goods were actually consumed. The
// total above is a running lifetime figure, not a monthly one -- the "Theo
// tháng" tab breaks it down by month and carries its own note explaining
// why the early months read 0đ.
function LifetimeNotice() {
  return (
    <p className="text-xs text-text-secondary">
      Số trên là tổng từ trước đến nay -- xem chi tiết theo lần xuất hoặc theo tháng ở các tab bên dưới.
    </p>
  );
}

// Plan G G5: reverses section 4's original "no period filter" -- the owner
// asked for a by-month tab after hearing the argument against one twice.
// In the owner's own words, not accounting language: a month reading 0đ
// before the first count does not mean nothing was used that month, only
// that nothing had been counted yet.
function MonthNotice() {
  return (
    <p className="text-xs text-text-secondary">
      Những tháng trước lần kiểm kê đầu tiên hiện 0đ -- không phải vì tháng đó không dùng gì, mà vì lúc đó chưa đếm để biết đã dùng bao nhiêu. Số chỉ thật sự có ý nghĩa khi tính giữa hai lần kiểm kê, mà hiện mới có đúng một lần.
    </p>
  );
}

function EventCard({
  kind,
  label,
  at,
  itemCount,
  value,
}: {
  kind: "STOCKTAKE" | "MANUAL";
  label: string;
  at: string;
  itemCount: number;
  value: number;
}) {
  const dateLabel = new Date(at).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            kind === "STOCKTAKE" ? "bg-primary-soft text-primary" : "bg-warning/10 text-warning"
          }`}
        >
          {kind === "STOCKTAKE" ? "Kiểm kê" : "Phiếu xuất"}
        </span>
        <span className="text-xs text-text-secondary">{dateLabel}</span>
      </div>
      <p className="font-bold text-text-primary text-sm leading-snug">{label}</p>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Số mặt hàng</span>
        <span className="font-semibold text-text-primary">{itemCount}</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Giá trị xuất</span>
        <span className="font-bold text-danger">{formatNumber(value)}đ</span>
      </div>
    </div>
  );
}

function MonthCard({ yearMonth, value }: { yearMonth: string; value: number }) {
  const [year, month] = yearMonth.split("-");
  const isZero = value === 0;
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4 flex items-center justify-between">
      <span className="font-bold text-text-primary text-sm">
        Tháng {Number(month)}/{year}
      </span>
      <span className={`font-bold ${isZero ? "text-text-muted" : "text-danger"}`}>
        {formatNumber(value)}đ
      </span>
    </div>
  );
}

export default async function IssuedValueReportPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const report = await getIssuedValueReport();
  const requestedTab = searchParams?.tab;
  const activeTab: Tab =
    requestedTab === "events" ? "events" : requestedTab === "months" ? "months" : "items";

  // Three tabs on one phone-width strip: fixed labels, not truncated --
  // "Theo nguyên liệu" is the longest and wraps to two lines on a narrow
  // screen rather than overflowing or shrinking illegibly. min-h-[44px] is
  // a floor, not a fixed height, so a wrapped label still gets a real tap
  // target, just a taller one. Checked at 360px width, the narrowest
  // common Android viewport.
  const tabs: Array<{ tab: Tab; label: string }> = [
    { tab: "items", label: "Theo nguyên liệu" },
    { tab: "events", label: "Theo lần xuất" },
    { tab: "months", label: "Theo tháng" },
  ];

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Giá trị hàng đã xuất</h1>
        <p className="text-3xl font-black text-danger mt-1">{formatNumber(report.grandTotal)}đ</p>
        <div className="mt-1">
          <LifetimeNotice />
        </div>
      </div>

      <div className="flex rounded-xl border border-border overflow-hidden">
        {tabs.map(({ tab, label }) => (
          <Link
            key={tab}
            href={tabHref(tab)}
            className={`flex-1 text-center px-1 py-2.5 text-sm font-bold leading-tight transition-colors min-h-[44px] flex items-center justify-center ${
              activeTab === tab ? "bg-primary text-white" : "bg-surface-card text-text-secondary"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {activeTab === "items" ? (
        report.items.length === 0 ? (
          <EmptyState title="Chưa có mặt hàng nào được xuất." />
        ) : (
          <div className="flex flex-col gap-3">
            {report.items.map(item => (
              <ItemCard key={item.purchasedItemId} {...item} />
            ))}
          </div>
        )
      ) : activeTab === "events" ? (
        report.events.length === 0 ? (
          <EmptyState title="Chưa có lần xuất nào." />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Owner rule 2026-07-30 (lib/display-rounding.ts): each card is
                rounded from its own exact value, not summed from rounded
                parts -- cộng các thẻ dưới đây có thể lệch vài đồng so với
                tổng ở trên, đó không phải là lỗi tính toán. */}
            <p className="text-xs text-text-secondary -mt-1">
              Mỗi thẻ làm tròn riêng theo số thật của nó -- cộng tay các thẻ có thể lệch vài đồng so với tổng ở trên, số ở trên mới là số đúng.
            </p>
            {report.events.map(event => (
              <EventCard
                key={event.key}
                kind={event.kind}
                label={event.label}
                at={event.at}
                itemCount={event.itemCount}
                value={event.value}
              />
            ))}
          </div>
        )
      ) : report.months.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu theo tháng." />
      ) : (
        <div className="flex flex-col gap-3">
          <MonthNotice />
          {report.months.map(month => (
            <MonthCard key={month.yearMonth} yearMonth={month.yearMonth} value={month.value} />
          ))}
        </div>
      )}
    </div>
  );
}
