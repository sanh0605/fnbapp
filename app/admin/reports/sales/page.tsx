import { findAll } from "@/lib/sheets_db";
import { getSalesDataV2, getHourlyHeatmapV2 } from "../actions";
import SalesFilter from "@/components/SalesFilter";
import SalesCharts from "@/components/SalesCharts";
import CategoryPieChart from "@/components/CategoryPieChart";
import { formatNumber } from "@/lib/format";

import ProductTable from "@/components/ProductTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronDown, AlertCircle } from "lucide-react";

export const dynamic = 'force-dynamic';

// Format Date as YYYY-MM-DD using local date parts (matches SalesFilter semantics).
function toDateOnlyForUrl(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [brands, users, categories] = await Promise.all([
    findAll("Brands"),
    findAll("Users"),
    findAll("Product_Categories")
  ]);

  const startParam = Array.isArray(searchParams?.start) ? searchParams.start[0] : searchParams?.start;
  const endParam = Array.isArray(searchParams?.end) ? searchParams.end[0] : searchParams?.end;
  const brandId = Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : searchParams?.brandId;
  const staffName = Array.isArray(searchParams?.staffName) ? searchParams.staffName[0] : searchParams?.staffName;
  const categoryId = Array.isArray(searchParams?.categoryId) ? searchParams.categoryId[0] : searchParams?.categoryId;

  // Build filters for V2
  const filters: any = {};
  if (brandId) filters.brandId = brandId;
  if (staffName) filters.staffName = staffName;
  if (categoryId) filters.categoryId = categoryId;

  // Claude code — fix 2026-06-26: pass date-only strings through to
  // toSaigonUtcRange. Previously pre-converted via new Date("YYYY-MM-DD")
  // which JS interprets as UTC midnight, causing Sales report to miss the
  // first 7 hours of the Saigon day (00:00-06:59). P&L page already does
  // this correctly by passing date-only directly.
  if (startParam && endParam) {
    filters.startDate = startParam;
    filters.endDate = endParam;
  } else {
    const today = new Date();
    const d1 = new Date(today.getFullYear(), today.getMonth(), 1);
    filters.startDate = toDateOnlyForUrl(d1);
    filters.endDate = toDateOnlyForUrl(today);
  }

  const [data, heatmapData] = await Promise.all([
    getSalesDataV2(filters),
    getHourlyHeatmapV2(filters)
  ]);

  // Re-build category chart data
  // getSalesDataV2 doesn't return category sales directly because it's tricky with product IDs.
  // Let's compute it quickly from bestSellers.
  // We map product_id -> category_id. But wait, we don't have products list loaded in getSalesDataV2?
  // Let's load products to map category.
  const products = await findAll("Products");
  const categorySalesMap: Record<string, number> = {};
  for (const item of data.bestSellers) {
    const p = (products as any[]).find(x => x.id === item.product_id);
    const catId = p?.category_id || "unknown";
    categorySalesMap[catId] = (categorySalesMap[catId] || 0) + item.totalRevenue;
  }
  for (const t of data.bestToppings) {
    categorySalesMap["topping"] = (categorySalesMap["topping"] || 0) + t.revenue;
  }

  const chartDataCategory = Object.entries(categorySalesMap).map(([catId, amount]) => {
    const c = (categories as any[]).find(x => x.id === catId);
    return {
      label: c ? c.name : (catId === "topping" ? "Topping" : "Khác"),
      amount: Math.round(amount)
    };
  });

  const {
    totalRevenue,
    totalOrders,
    avgOrderValue,
    grossRevenue,
    systemPromotionDiscount,
    manualItemDiscount,
    manualOrderDiscount,
    totalDiscount,
    paymentBreakdown,
    bestSellers,
    bestToppings,
    uniqueSizes,
    totalQtyBySize,
    totalQtyAll,
    salesByDate,
    salesByMonth,
    salesByDayOfWeek,
    salesByHour,
  } = data;

  const bestDrinks = bestSellers.filter(item => {
    const p = (products as any[]).find(x => x.id === item.product_id);
    return p?.category_id !== "CAT-006"; // CAT-006 is Food
  });

  const bestFoods = bestSellers.filter(item => {
    const p = (products as any[]).find(x => x.id === item.product_id);
    return p?.category_id === "CAT-006";
  });

  const totalToppingQty = bestToppings.reduce((s, t) => s + t.qty, 0);
  const totalToppingRevenue = bestToppings.reduce((s, t) => s + t.revenue, 0);

  return (
    <div className="space-y-6">
      <SalesFilter
        brands={brands}
        users={users}
        categories={categories}
        title="Báo cáo Bán hàng"
        subtitle="Phân tích hiệu quả kinh doanh theo thời gian (V2)."
      />

      {/* Claude code — spec compliance: note COGS không áp dụng sales report (chỉ P&L) */}

      {data.v2OrderCount === 0 && (
        <div className="bg-warning-soft text-warning p-4 rounded-xl border border-warning/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>Lưu ý:</strong> Không có đơn hàng V2 nào trong khoảng thời gian này. Báo cáo bán hàng đã được chuyển sang dữ liệu V2 (từ 19/06/2026). Dữ liệu V1 cũ không còn hiển thị ở đây.
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <div className="text-sm font-medium text-text-secondary mb-1">Tổng Doanh Thu (Net)</div>
          <div className="text-3xl font-bold text-text-primary">{formatNumber(totalRevenue)}</div>
          <div className="text-xs text-text-muted mt-2">
            Gross: {formatNumber(grossRevenue)}
            {" • "}
            Giảm giá: {formatNumber(totalDiscount)}
          </div>
        </div>
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <div className="text-sm font-medium text-text-secondary mb-1">Tổng Số Đơn</div>
          <div className="text-3xl font-bold text-text-primary">{totalOrders} <span className="text-sm font-normal text-text-secondary">đơn</span></div>
          <div className="text-xs text-text-muted mt-2">
            {paymentBreakdown.map(p => `${p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method}: ${p.orderCount}`).join(" • ")}
          </div>
        </div>
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <div className="text-sm font-medium text-text-secondary mb-1">Doanh Thu Trung Bình / Đơn</div>
          <div className="text-3xl font-bold text-text-primary">{formatNumber(Math.round(avgOrderValue))}</div>
          <div className="text-xs text-text-muted mt-2">
            Khuyến mãi hệ thống: {formatNumber(systemPromotionDiscount)}
          </div>
        </div>
      </div>

      {/* Discount + Payment breakdown (Claude code — Phase 5.2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <h3 className="font-bold text-text-primary text-base mb-3">Chi tiết Giảm giá</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Khuyến mãi hệ thống</dt>
              <dd className="font-medium text-text-primary">{formatNumber(systemPromotionDiscount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Giảm giá theo dòng</dt>
              <dd className="font-medium text-text-primary">{formatNumber(manualItemDiscount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Giảm giá trên toàn đơn</dt>
              <dd className="font-medium text-text-primary">{formatNumber(manualOrderDiscount)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-semibold text-text-primary">Tổng Giảm giá</dt>
              <dd className="font-bold text-danger">{formatNumber(totalDiscount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Doanh thu Gross</dt>
              <dd className="font-medium text-text-primary">{formatNumber(grossRevenue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Doanh thu Net</dt>
              <dd className="font-bold text-success">{formatNumber(totalRevenue)}</dd>
            </div>
          </dl>
        </div>
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border">
          <h3 className="font-bold text-text-primary text-base mb-3">Doanh thu theo PT Thanh toán</h3>
          <table className="w-full text-sm">
            <thead className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold text-left">Phương thức</th>
                <th scope="col" className="px-6 py-4 font-bold text-right">Số đơn</th>
                <th scope="col" className="px-6 py-4 font-bold text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paymentBreakdown.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-4 text-text-muted">Không có dữ liệu</td></tr>
              ) : (
                paymentBreakdown.map(p => (
                  <tr key={p.method} className="hover:bg-page transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">
                      {p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method}
                    </td>
                    <td className="px-6 py-4 text-right text-text-secondary">{p.orderCount}</td>
                    <td className="px-6 py-4 text-right text-success font-medium">{formatNumber(p.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hourly Heatmap Section */}
      <div className="bg-surface-card rounded-card shadow-sm border border-border p-6">
        <div className="mb-4">
          <h3 className="font-bold text-text-primary text-lg">Ma trận Doanh thu theo Giờ (Heatmap)</h3>
          <p className="text-sm text-text-secondary">Phân bổ doanh thu theo giờ trong ngày và thứ trong tuần.</p>
        </div>
        
        {/* Mobile List View (< 768px) */}
        <div className="md:hidden space-y-2 pb-2">
          {heatmapData.filter(c => c.revenue > 0).length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">Không có dữ liệu doanh thu</div>
          ) : (
            (() => {
              const dayOrder = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
              return dayOrder
                .map(day => {
                  const dayCells = heatmapData
                    .filter(c => c.dayOfWeek === day && c.revenue > 0)
                    .sort((a, b) => a.hour - b.hour);
                  if (dayCells.length === 0) return null;
                  const dayLabel = day === "CN" ? "Chủ Nhật" : `Thứ ${day.replace("T", "")}`;
                  const dayTotalRevenue = dayCells.reduce((s, c) => s + c.revenue, 0);
                  const dayTotalOrders = dayCells.reduce((s, c) => s + c.orderCount, 0);
                  return (
                    <details key={day} className="rounded-xl border border-border bg-page overflow-hidden group">
                      <summary className="flex items-center justify-between p-3 cursor-pointer list-none min-h-[44px] [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 shrink-0 rounded-lg bg-primary-soft text-primary flex items-center justify-center font-bold text-sm">
                            {day === "CN" ? "CN" : day}
                          </div>
                          <div>
                            <div className="font-semibold text-text-primary">{dayLabel}</div>
                            <div className="text-xs text-text-secondary">{dayTotalOrders} đơn</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-success">{formatNumber(dayTotalRevenue)}</div>
                          <div className="text-[10px] text-text-muted flex items-center justify-end gap-1">
                            tap để mở/đóng
                            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                          </div>
                        </div>
                      </summary>
                      <div className="px-3 pb-3 pt-1 space-y-1 border-t border-border/50 bg-surface-card">
                        {dayCells.map(c => (
                          <div key={`${day}-${c.hour}`} className="flex items-center justify-between py-2 min-h-[36px]">
                            <div className="flex items-center gap-3">
                              <div className="w-9 text-sm font-bold text-text-primary text-center">{c.hour}h</div>
                              <div className="text-xs text-text-secondary">{c.orderCount} đơn</div>
                            </div>
                            <div className="text-sm font-medium text-text-primary">{formatNumber(c.revenue)}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })
                .filter(Boolean);
            })()
          )}
        </div>

        {/* Desktop Grid View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto table-mobile-scroll pb-2">
          <div className="min-w-[1120px] space-y-1">
            {/* Header: Hours */}
            <div className="flex items-center">
              <div className="w-16 shrink-0 text-xs text-text-muted font-bold text-center">Thứ</div>
              <div className="flex-1 gap-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                  <div key={h} className="text-center text-[10px] text-text-muted font-medium">
                    {h}h
                  </div>
                ))}
              </div>
            </div>

            {/* Rows: DOW */}
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(day => {
              const maxRevenue = Math.max(...heatmapData.map(c => c.revenue), 1);
              return (
                <div key={day} className="flex items-center h-11">
                  <div className="w-16 shrink-0 text-sm font-semibold text-text-secondary">
                    {day === "CN" ? "Chủ Nhật" : `Thứ ${day.replace("T", "")}`}
                  </div>
                  <div className="flex-1 gap-1 h-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                    {Array.from({ length: 24 }, (_, i) => i).map(hour => {
                      const cell = heatmapData.find(c => c.dayOfWeek === day && c.hour === hour) || { revenue: 0, orderCount: 0 };
                      const opacity = maxRevenue > 0 ? (cell.revenue / maxRevenue) : 0;
                      const scaledOpacity = opacity > 0 ? 0.08 + opacity * 0.87 : 0.03;
                      
                      return (
                        <div
                          key={hour}
                          title={`${day}, ${hour}h: ${formatNumber(cell.revenue)} (${cell.orderCount} đơn)`}
                          className="rounded-md border border-border/50 flex flex-col items-center justify-center transition-transform transition-shadow hover:scale-105 hover:shadow-sm cursor-pointer"
                          style={{
                            backgroundColor: cell.revenue > 0 ? `rgba(37, 99, 235, ${scaledOpacity})` : 'var(--color-bg-page)',
                            color: scaledOpacity > 0.5 ? '#ffffff' : 'var(--color-text-primary)',
                          }}
                        >
                          {cell.revenue > 0 && (
                            <span className="text-[10px] font-black leading-none truncate max-w-full px-0.5">
                              {cell.revenue >= 1000000 
                                ? `${(cell.revenue / 1000000).toFixed(1)}M` 
                                : cell.revenue >= 1000 
                                  ? `${Math.round(cell.revenue / 1000)}k` 
                                  : cell.revenue}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-3 text-xs text-text-secondary hidden md:flex">
          <span>Doanh thu thấp</span>
          <div className="flex gap-1 h-4">
            <div className="w-6 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.05)' }}></div>
            <div className="w-6 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.25)' }}></div>
            <div className="w-6 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.55)' }}></div>
            <div className="w-6 rounded" style={{ backgroundColor: 'rgba(37, 99, 235, 0.9)' }}></div>
          </div>
          <span>Doanh thu cao</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
        <SalesCharts 
          salesByDate={salesByDate}
          salesByDayOfWeek={salesByDayOfWeek}
          salesByHour={salesByHour}
          salesByMonth={salesByMonth}
        />

        {/* Category Pie Chart */}
        <div className="xl:col-span-1">
          <CategoryPieChart data={chartDataCategory} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ProductTable title="Top sale - Nước" items={bestDrinks} uniqueSizes={uniqueSizes} />
        <ProductTable title="Top sale - Thức ăn" items={bestFoods} uniqueSizes={uniqueSizes} />

        {/* Toppings Table */}
        <div className="xl:col-span-1 bg-surface-card rounded-card shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border bg-page flex justify-between items-center">
            <h3 className="font-bold text-text-primary">Top Topping Bán Chạy</h3>
          </div>
          <div className="hidden md:block overflow-x-auto max-h-[528px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-6 py-4 font-bold">Topping</th>
                  <th scope="col" className="px-6 py-4 font-bold text-right">Số lượng</th>
                  <th scope="col" className="px-6 py-4 font-bold text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {bestToppings.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-text-muted">Không có topping nào</td></tr>
                ) : (
                  bestToppings.map((item, i) => (
                    <tr key={i} className="hover:bg-page transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary">{item.name}</td>
                      <td className="px-6 py-4 text-right font-bold text-text-secondary">{item.qty}</td>
                      <td className="px-6 py-4 text-right text-success font-medium">{formatNumber(Math.round(item.revenue))}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {bestToppings.length > 0 && (
                <tfoot className="bg-page border-t-2 border-border sticky bottom-0 z-10 font-bold text-text-primary shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                  <tr className="bg-page">
                    <td className="px-6 py-4 font-bold">Tổng cộng</td>
                    <td className="px-6 py-4 text-right font-bold">{totalToppingQty.toLocaleString("vi-VN")}</td>
                    <td className="px-6 py-4 text-right text-success font-bold">{formatNumber(Math.round(totalToppingRevenue))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[528px] bg-page/50">
            {bestToppings.length === 0 ? (
              <div className="text-center py-8 text-text-muted">Không có topping nào</div>
            ) : (
              bestToppings.map((item, i) => (
                <div key={i} className="bg-surface-card rounded-xl p-4 shadow-sm border border-border flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-bold text-text-primary">{item.name}</div>
                    <div className="font-bold text-success shrink-0">{formatNumber(Math.round(item.revenue))}</div>
                  </div>
                  <div className="text-sm text-text-secondary flex items-center gap-2">
                    <span className="text-text-muted">Số lượng:</span>
                    <span className="font-semibold text-text-primary">{item.qty}</span>
                  </div>
                </div>
              ))
            )}
            {bestToppings.length > 0 && (
              <div className="mt-2 pt-3 border-t border-border flex justify-between items-center font-bold text-text-primary">
                <div className="flex items-center gap-2">
                  <span>Tổng:</span>
                  <span>{totalToppingQty.toLocaleString("vi-VN")}</span>
                </div>
                <div className="text-success">{formatNumber(Math.round(totalToppingRevenue))}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
