import { getIssuedValueReport } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/shared/format";
import { formatDate } from "@/lib/shared/datetime";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { ItemCard } from "./ItemCard";
import { EventCard } from "./EventCard";

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
  // screen rather than overflowing or shrinking illegibly. min-h-[44px] md:min-h-[40px] is
  // a floor, not a fixed height, so a wrapped label still gets a real tap
  // target, just a taller one. Checked at 360px width, the narrowest
  // common Android viewport.
  const tabs: Array<{ tab: Tab; label: string }> = [
    { tab: "items", label: "Theo nguyên liệu" },
    { tab: "events", label: "Theo lần xuất" },
    { tab: "months", label: "Theo tháng" },
  ];

  return (
    <div className="space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div>
        <PageHeader title="Hàng đã xuất" />
        <p className="text-3xl font-black text-danger -mt-4 mb-1">{formatNumber(report.grandTotal)}đ</p>
        <div className="mt-1">
          <LifetimeNotice />
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map(({ tab, label }) => (
          <Button
            key={tab}
            href={tabHref(tab)}
            variant={activeTab === tab ? "primary" : "secondary"}
            className="flex-1 md:flex-none"
          >
            {label}
          </Button>
        ))}
      </div>

      {activeTab === "items" ? (
        report.items.length === 0 ? (
          <EmptyState title="Chưa có mặt hàng nào được xuất." />
        ) : (
          <>
            <div className="md:hidden flex flex-col gap-3">
              {report.items.map(item => (
                <ItemCard key={item.purchasedItemId} {...item} />
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Nguyên liệu</TableHeaderCell>
                  <TableHeaderCell>Đã xuất</TableHeaderCell>
                  <TableHeaderCell>Giá trị đã xuất</TableHeaderCell>
                  <TableHeaderCell>Giá trị tồn còn lại</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {report.items.map(item => (
                    <TableRow key={item.purchasedItemId}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">
                        {formatNumber(item.issuedQuantity, { withDecimals: true })} {item.unitName}
                      </TableCell>
                      <TableCell align="right" tone="negative">
                        {formatNumber(item.issuedValue)}đ
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(item.closingValue)}đ
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )
      ) : activeTab === "events" ? (
        report.events.length === 0 ? (
          <EmptyState title="Chưa có lần xuất nào." />
        ) : (
          <>
            {/* BR-DATA-005 (lib/reports/display-rounding.ts): each card is
                rounded from its own exact value, not summed from rounded
                parts -- cộng các thẻ dưới đây có thể lệch vài đồng so với
                tổng ở trên, đó không phải là lỗi tính toán. */}
            <p className="text-xs text-text-secondary -mt-1">
              Mỗi thẻ làm tròn riêng theo số thật của nó -- cộng tay các thẻ có thể lệch vài đồng so với tổng ở trên, số ở trên mới là số đúng.
            </p>
            <div className="md:hidden flex flex-col gap-3">
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
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Loại</TableHeaderCell>
                  <TableHeaderCell>Ngày</TableHeaderCell>
                  <TableHeaderCell>Lần xuất</TableHeaderCell>
                  <TableHeaderCell>Số mặt hàng</TableHeaderCell>
                  <TableHeaderCell>Giá trị xuất</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {report.events.map(event => (
                    <TableRow key={event.key}>
                      <TableCell>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            event.kind === "STOCKTAKE"
                              ? "bg-primary-soft text-primary"
                              : "bg-warning/10 text-warning"
                          }`}
                        >
                          {event.kind === "STOCKTAKE" ? "Kiểm kê" : "Phiếu xuất"}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(event.at)}</TableCell>
                      <TableCell>{event.label}</TableCell>
                      <TableCell align="right">{event.itemCount}</TableCell>
                      <TableCell align="right" tone="negative">{formatNumber(event.value)}đ</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )
      ) : report.months.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu theo tháng." />
      ) : (
        <>
          <MonthNotice />
          <div className="md:hidden flex flex-col gap-3">
            {report.months.map(month => (
              <MonthCard key={month.yearMonth} yearMonth={month.yearMonth} value={month.value} />
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHead>
                <TableHeaderCell>Tháng</TableHeaderCell>
                <TableHeaderCell>Giá trị</TableHeaderCell>
              </TableHead>
              <TableBody>
                {report.months.map(month => {
                  const [year, monthNum] = month.yearMonth.split("-");
                  const isZero = month.value === 0;
                  return (
                    <TableRow key={month.yearMonth}>
                      <TableCell>Tháng {Number(monthNum)}/{year}</TableCell>
                      <TableCell align="right" tone={isZero ? "muted" : "negative"}>
                        {formatNumber(month.value)}đ
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
