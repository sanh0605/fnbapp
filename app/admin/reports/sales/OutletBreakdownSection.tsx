import { formatNumber } from "@/lib/format";
import { avgPerOrder, percentOfTotal, formatPercent } from "@/lib/outlet-breakdown-table";

interface OutletBreakdownRow {
  outlet_id: string;
  name: string;
  orderCount: number;
  revenue: number;
}

interface OutletBreakdownSectionProps {
  outletBreakdown: OutletBreakdownRow[];
}

// docs/superpowers/plans/2026-08-25-outlet-breakdown-table.md: one dataset,
// two shapes. CLAUDE.md section 8 forbids a horizontal table on a phone,
// not on a desktop -- the cards this replaced were a misreading of that
// rule. Below md: the original stacked cards, unchanged. From md up: a
// real table, scrolling on its own so the page body never scrolls
// sideways. Presentation only -- totals here are summed straight from the
// same outletBreakdown array the cards always rendered, nothing recomputed.
//
// Extracted out of page.tsx (an async Server Component) so it is directly
// render-testable, same reason as app/admin/outlets/components/OutletsList.tsx.
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
              <span className="font-bold text-success">{formatNumber(o.revenue)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* From md up: a real table. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
              <th scope="col" className="px-4 py-3 font-bold">Điểm bán</th>
              <th scope="col" className="px-4 py-3 font-bold text-right">Số đơn</th>
              <th scope="col" className="px-4 py-3 font-bold text-right">Doanh thu</th>
              <th scope="col" className="px-4 py-3 font-bold text-right">TB/đơn</th>
              <th scope="col" className="px-4 py-3 font-bold text-right">% tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {outletBreakdown.map(o => {
              const avg = avgPerOrder(o.revenue, o.orderCount);
              const pct = percentOfTotal(o.revenue, totalRevenue);
              return (
                <tr key={o.outlet_id || "none"} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-text-primary">{o.name}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary text-right">{formatNumber(o.orderCount)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-success text-right">{formatNumber(o.revenue)}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary text-right">
                    {avg === null ? "—" : formatNumber(avg)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary text-right">{formatPercent(pct)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-bold text-text-primary">
              <td className="px-4 py-3 text-sm">Tổng</td>
              <td className="px-4 py-3 text-sm text-right">{formatNumber(totalOrders)}</td>
              <td className="px-4 py-3 text-sm text-success text-right">{formatNumber(totalRevenue)}</td>
              <td className="px-4 py-3 text-sm text-right" />
              <td className="px-4 py-3 text-sm text-right" />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
