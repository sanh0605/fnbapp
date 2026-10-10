import { formatNumber } from "@/lib/shared/format";
import { avgPerOrder, percentOfTotal, formatPercent } from "@/lib/reports/outlet-breakdown-table";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableTotalRow,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";

interface OutletBreakdownRow {
  outlet_id: string;
  name: string;
  orderCount: number;
  revenue: number;
}

interface OutletBreakdownSectionProps {
  outletBreakdown: OutletBreakdownRow[];
}

// Per that plan: one dataset,
// two shapes. CLAUDE.md "Viết code" forbids a horizontal table on a phone,
// not on a desktop -- the cards this replaced were a misreading of that
// rule. Below md: the original stacked cards, unchanged. From md up: a
// real table, scrolling on its own so the page body never scrolls
// sideways. Presentation only -- totals here are summed straight from the
// same outletBreakdown array the cards always rendered, nothing recomputed.
//
// Extracted out of page.tsx (an async Server Component) so it is directly
// render-testable, same reason as app/admin/outlets/components/OutletsClient.tsx.
export function OutletBreakdownSection({ outletBreakdown }: OutletBreakdownSectionProps) {
  if (outletBreakdown.length === 0) {
    return <div className="text-center py-6 text-text-muted text-sm">Không có dữ liệu</div>;
  }

  const totalOrders = outletBreakdown.reduce((sum, o) => sum + o.orderCount, 0);
  const totalRevenue = outletBreakdown.reduce((sum, o) => sum + o.revenue, 0);

  return (
    <>
      {/* Below md: unchanged stacked cards, one per outlet. lg:grid-cols-3
          dropped -- it could never take effect once md:hidden hides this
          whole block at the lg breakpoint too. */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
        {outletBreakdown.map(o => (
          <div
            key={o.outlet_id || "none"}
            className="bg-page rounded-xl p-4 border border-border flex flex-col gap-2"
          >
            <div className="font-bold text-text-primary">{o.name}</div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-text-secondary">{o.orderCount} đơn</span>
              <span className="font-bold text-text-primary">{formatNumber(o.revenue)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* From md up: a real table. */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableHeaderCell>Điểm bán</TableHeaderCell>
            <TableHeaderCell>Số đơn</TableHeaderCell>
            <TableHeaderCell>Doanh thu</TableHeaderCell>
            <TableHeaderCell>TB/đơn</TableHeaderCell>
            <TableHeaderCell>% tổng</TableHeaderCell>
          </TableHead>
          <TableTotalRow>
            <TableCell>Tổng</TableCell>
            <TableCell align="right">{formatNumber(totalOrders)}</TableCell>
            <TableCell align="right">{formatNumber(totalRevenue)}</TableCell>
            <TableCell align="right" />
            <TableCell align="right" />
          </TableTotalRow>
          <TableBody>
            {outletBreakdown.map(o => {
              const avg = avgPerOrder(o.revenue, o.orderCount);
              const pct = percentOfTotal(o.revenue, totalRevenue);
              return (
                <TableRow key={o.outlet_id || "none"}>
                  <TableCell>{o.name}</TableCell>
                  <TableCell align="right">{formatNumber(o.orderCount)}</TableCell>
                  <TableCell align="right">{formatNumber(o.revenue)}</TableCell>
                  <TableCell align="right">{avg === null ? "—" : formatNumber(avg)}</TableCell>
                  <TableCell align="right">{formatPercent(pct)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
