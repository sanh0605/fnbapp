import Link from "next/link";
import { getIssuedValueReport } from "./actions";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

type Tab = "items" | "events";

function tabHref(tab: Tab): string {
  return `/admin/reports/issued?tab=${tab}`;
}

// Plan G section 1: all issued value to date falls in the month the first
// stocktake closed, not the month goods were actually consumed -- a period
// only becomes meaningful between two counts, and there has been one. No
// period filter (section 4) so this page cannot be misread as a monthly
// figure; this line says so in place of a filter.
function LifetimeNotice() {
  return (
    <p className="text-xs text-text-secondary">
      Tính từ khi có dữ liệu kiểm kê đầu tiên, không theo tháng -- xem chi tiết theo lần xuất ở tab bên cạnh.
    </p>
  );
}

function ItemCard({
  name,
  unitName,
  issuedQuantity,
  issuedValue,
  closingValue,
}: {
  name: string;
  unitName: string;
  issuedQuantity: number;
  issuedValue: number;
  closingValue: number;
}) {
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <p className="font-bold text-text-primary text-sm leading-snug">{name}</p>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Đã xuất</span>
        <span className="font-semibold text-text-primary">
          {formatNumber(issuedQuantity, { withDecimals: true })} {unitName}
        </span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Giá trị đã xuất</span>
        <span className="font-bold text-danger">{formatNumber(issuedValue)}đ</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Giá trị tồn còn lại</span>
        <span className="font-semibold text-text-primary">{formatNumber(closingValue)}đ</span>
      </div>
    </div>
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

export default async function IssuedValueReportPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const report = await getIssuedValueReport();
  const activeTab: Tab = searchParams?.tab === "events" ? "events" : "items";

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
        <Link
          href={tabHref("items")}
          className={`flex-1 text-center py-3 text-sm font-bold transition-colors min-h-[44px] flex items-center justify-center ${
            activeTab === "items" ? "bg-primary text-white" : "bg-surface-card text-text-secondary"
          }`}
        >
          Theo nguyên liệu
        </Link>
        <Link
          href={tabHref("events")}
          className={`flex-1 text-center py-3 text-sm font-bold transition-colors min-h-[44px] flex items-center justify-center ${
            activeTab === "events" ? "bg-primary text-white" : "bg-surface-card text-text-secondary"
          }`}
        >
          Theo lần xuất
        </Link>
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
      ) : report.events.length === 0 ? (
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
      )}
    </div>
  );
}
