import { getIssuedValueReport } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/shared/format";
import { formatDate, saigonToday, formatMonthLabel } from "@/lib/shared/datetime";
import { readMonthRangeParams, type RawParams } from "@/lib/shared/date-range-params";
import { DateRangeUrlButton } from "@/components/ui/DateRangeUrlButton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableTotalRow,
  TableBody,
  TableRow,
  TableRowHeader,
  TableCell,
} from "@/components/ui/Table";
import { EventCard } from "./EventCard";

export const dynamic = "force-dynamic";

type Tab = "items" | "events" | "months";

function tabHref(tab: Tab, searchParams?: RawParams): string {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "tab" || value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else {
        params.set(key, value);
      }
    }
  }
  params.set("tab", tab);
  return `/admin/reports/issued?${params.toString()}`;
}

export default async function IssuedValueReportPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = (await props.searchParams) ?? {};
  const today = saigonToday();
  const range = readMonthRangeParams(searchParams, today);
  const report = await getIssuedValueReport(range);

  const requestedTab = searchParams.tab;
  const activeTab: Tab =
    requestedTab === "events" ? "events" : requestedTab === "months" ? "months" : "items";

  const tabs: Array<{ tab: Tab; label: string }> = [
    { tab: "items", label: "Theo nguyên liệu" },
    { tab: "events", label: "Theo lần xuất" },
    { tab: "months", label: "Theo tháng" },
  ];

  return (
    <div className="space-y-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {/* 1. Page Header with month-range bar (default Năm nay) */}
      <PageHeader
        title="Hàng đã xuất"
        subtitle={`Theo dõi giá trị nguyên liệu đã xuất kho từ ${formatMonthLabel(range.start)} đến ${formatMonthLabel(range.end)} · đơn vị: đồng`}
        actions={<DateRangeUrlButton mode="month" value={range} today={today} />}
      />

      {/* 2. Headline figures (BR-UI-017) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-card p-5 border border-border shadow-sm">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
            Tổng giá trị đã xuất
          </div>
          <div className="text-2xl font-bold text-danger">{formatNumber(report.grandTotal)}đ</div>
        </div>
        <div className="bg-surface-card rounded-card p-5 border border-border shadow-sm">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
            Hàng dùng
          </div>
          <div className="text-2xl font-bold text-text-primary">{formatNumber(report.usedTotal)}đ</div>
        </div>
        <div className="bg-surface-card rounded-card p-5 border border-border shadow-sm">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
            Hao hụt
          </div>
          <div className="text-2xl font-bold text-text-primary">{formatNumber(report.shrinkageTotal)}đ</div>
        </div>
      </div>

      {/* 3. Tabs: Tab links keep from/to range in their URL */}
      <div className="flex gap-2">
        {tabs.map(({ tab, label }) => (
          <Button
            key={tab}
            href={tabHref(tab, searchParams)}
            variant={activeTab === tab ? "primary" : "secondary"}
            className="flex-1 md:flex-none"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* 4. Tab contents */}
      {activeTab === "items" ? (
        report.items.length === 0 ? (
          <EmptyState title="Chưa có mặt hàng nào được xuất trong khoảng thời gian này." />
        ) : (
          <Table>
            <TableHead>
              <TableHeaderCell stick="left">Nguyên liệu</TableHeaderCell>
              <TableHeaderCell>Đã xuất</TableHeaderCell>
              <TableHeaderCell>Giá trị đã xuất</TableHeaderCell>
              <TableHeaderCell>Giá trị tồn còn lại</TableHeaderCell>
            </TableHead>
            <TableTotalRow>
              <TableCell stick="left">Tổng cộng</TableCell>
              <TableCell align="right" />
              <TableCell align="right" tone="negative">{formatNumber(report.grandTotal)}đ</TableCell>
              <TableCell align="right" />
            </TableTotalRow>
            <TableBody>
              {report.items.map((item) => (
                <TableRow key={item.purchasedItemId}>
                  <TableRowHeader stick="left">{item.name}</TableRowHeader>
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
        )
      ) : activeTab === "events" ? (
        report.events.length === 0 ? (
          <EmptyState title="Chưa có lần xuất nào trong khoảng thời gian này." />
        ) : (
          <>
            <p className="text-xs text-text-secondary -mt-1">
              Mỗi dòng làm tròn riêng theo số thật của nó -- cộng tay các dòng có thể lệch vài đồng so với tổng ở trên, số ở trên mới là số đúng.
            </p>
            <div className="md:hidden space-y-3">
              <div className="divide-y divide-border bg-surface-card rounded-xl border border-border px-4">
                {report.events.map((event) => (
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
              <div className="px-4 py-2 bg-primary-soft text-sm text-text-primary tabular-nums">
                Tổng cộng: {formatNumber(report.grandTotal)}đ
              </div>
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
                <TableTotalRow>
                  <TableCell colSpan={4}>Tổng cộng</TableCell>
                  <TableCell align="right" tone="negative">{formatNumber(report.grandTotal)}đ</TableCell>
                </TableTotalRow>
                <TableBody>
                  {report.events.map((event) => (
                    <TableRow key={event.key}>
                      <TableCell>
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
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
        <EmptyState title="Chưa có dữ liệu theo tháng trong khoảng thời gian này." />
      ) : (
        <>
          <p className="text-xs text-text-secondary -mt-1">
            Những tháng trước lần kiểm kê đầu tiên hiện 0đ -- không phải vì tháng đó không dùng gì, mà vì lúc đó chưa đếm để biết đã dùng bao nhiêu.
          </p>
          <Table>
            <TableHead>
              <TableHeaderCell stick="left">Tháng</TableHeaderCell>
              <TableHeaderCell>Hàng dùng</TableHeaderCell>
              <TableHeaderCell>Hao hụt</TableHeaderCell>
              <TableHeaderCell>Tổng cộng</TableHeaderCell>
            </TableHead>
            <TableTotalRow>
              <TableCell stick="left">Tổng cộng</TableCell>
              <TableCell align="right" tone={report.usedTotal === 0 ? "muted" : "negative"}>
                {formatNumber(report.usedTotal)}đ
              </TableCell>
              <TableCell align="right" tone={report.shrinkageTotal === 0 ? "muted" : "negative"}>
                {formatNumber(report.shrinkageTotal)}đ
              </TableCell>
              <TableCell align="right" tone={report.grandTotal === 0 ? "muted" : "negative"}>
                {formatNumber(report.grandTotal)}đ
              </TableCell>
            </TableTotalRow>
            <TableBody>
              {report.months.map((month) => {
                const monthTotal = month.usedValue + month.shrinkageValue;
                return (
                  <TableRow key={month.yearMonth}>
                    <TableRowHeader stick="left">Tháng {formatMonthLabel(month.yearMonth)}</TableRowHeader>
                    <TableCell align="right" tone={month.usedValue === 0 ? "muted" : "negative"}>
                      {formatNumber(month.usedValue)}đ
                    </TableCell>
                    <TableCell align="right" tone={month.shrinkageValue === 0 ? "muted" : "negative"}>
                      {formatNumber(month.shrinkageValue)}đ
                    </TableCell>
                    <TableCell align="right" tone={monthTotal === 0 ? "muted" : "negative"}>
                      {formatNumber(monthTotal)}đ
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
