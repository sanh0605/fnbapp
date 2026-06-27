import { findAll } from "@/lib/sheets_db";
import { getSalesDataV2, getHourlyHeatmapV2 } from "../actions";
import SalesFilter from "@/components/SalesFilter";
import SalesCharts from "@/components/SalesCharts";
import CategoryPieChart from "@/components/CategoryPieChart";

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

  const totalToppingQty = bestToppings.reduce((s, t) => s + t.qty, 0);
  const totalToppingRevenue = bestToppings.reduce((s, t) => s + t.revenue, 0);
  const totalRevenueAll = bestSellers.reduce((s, i) => s + i.totalRevenue, 0);

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
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200">
          <strong>Lưu ý:</strong> Không có đơn hàng V2 nào trong khoảng thời gian này. Báo cáo bán hàng đã được chuyển sang dữ liệu V2 (từ 19/06/2026). Dữ liệu V1 cũ không còn hiển thị ở đây.
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Tổng Doanh Thu (Net)</div>
          <div className="text-3xl font-bold text-gray-900">{totalRevenue.toLocaleString("vi-VN")} đ</div>
          <div className="text-xs text-gray-400 mt-2">
            Gross: {grossRevenue.toLocaleString("vi-VN")} đ
            {" • "}
            Giảm giá: {totalDiscount.toLocaleString("vi-VN")} đ
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Tổng Số Đơn</div>
          <div className="text-3xl font-bold text-gray-900">{totalOrders} <span className="text-sm font-normal text-gray-500">đơn</span></div>
          <div className="text-xs text-gray-400 mt-2">
            {paymentBreakdown.map(p => `${p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method}: ${p.orderCount}`).join(" • ")}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Doanh Thu Trung Bình / Đơn</div>
          <div className="text-3xl font-bold text-gray-900">{Math.round(avgOrderValue).toLocaleString("vi-VN")} đ</div>
          <div className="text-xs text-gray-400 mt-2">
            Khuyến mãi hệ thống: {systemPromotionDiscount.toLocaleString("vi-VN")} đ
          </div>
        </div>
      </div>

      {/* Discount + Payment breakdown (Claude code — Phase 5.2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 text-base mb-3">Chi tiết Giảm giá</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Khuyến mãi hệ thống</dt>
              <dd className="font-medium text-gray-900">{systemPromotionDiscount.toLocaleString("vi-VN")} đ</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Giảm giá theo dòng</dt>
              <dd className="font-medium text-gray-900">{manualItemDiscount.toLocaleString("vi-VN")} đ</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Giảm giá trên toàn đơn</dt>
              <dd className="font-medium text-gray-900">{manualOrderDiscount.toLocaleString("vi-VN")} đ</dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <dt className="font-semibold text-gray-700">Tổng Giảm giá</dt>
              <dd className="font-bold text-red-600">{totalDiscount.toLocaleString("vi-VN")} đ</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Doanh thu Gross</dt>
              <dd className="font-medium text-gray-900">{grossRevenue.toLocaleString("vi-VN")} đ</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Doanh thu Net</dt>
              <dd className="font-bold text-green-700">{totalRevenue.toLocaleString("vi-VN")} đ</dd>
            </div>
          </dl>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 text-base mb-3">Doanh thu theo PT Thanh toán</h3>
          <table className="w-full text-sm">
            <thead className="text-gray-400 font-medium">
              <tr>
                <th className="text-left py-2">Phương thức</th>
                <th className="text-right py-2">Số đơn</th>
                <th className="text-right py-2">Doanh thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paymentBreakdown.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-4 text-gray-400">Không có dữ liệu</td></tr>
              ) : (
                paymentBreakdown.map(p => (
                  <tr key={p.method}>
                    <td className="py-2 font-medium text-gray-800">
                      {p.method === "CASH" ? "Tiền mặt" : p.method === "BANK_TRANSFER" ? "Chuyển khoản" : p.method}
                    </td>
                    <td className="py-2 text-right text-gray-700">{p.orderCount}</td>
                    <td className="py-2 text-right text-green-700 font-medium">{p.revenue.toLocaleString("vi-VN")} đ</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hourly Heatmap Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="mb-4">
          <h3 className="font-bold text-gray-900 text-lg">Ma trận Doanh thu theo Giờ (Heatmap)</h3>
          <p className="text-sm text-gray-500">Phân bổ doanh thu theo giờ trong ngày và thứ trong tuần.</p>
        </div>
        
        {/* Mobile List View (< 768px) */}
        <div className="md:hidden space-y-3 pb-2">
          {heatmapData.filter(c => c.revenue > 0).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Không có dữ liệu doanh thu</div>
          ) : (
            heatmapData
              .filter(c => c.revenue > 0)
              .sort((a, b) => {
                const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
                if (a.dayOfWeek !== b.dayOfWeek) {
                  return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                }
                return a.hour - b.hour;
              })
              .map((cell, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-sm">
                      {cell.hour}h
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{cell.dayOfWeek === "CN" ? "Chủ Nhật" : `Thứ ${cell.dayOfWeek.replace("T", "")}`}</div>
                      <div className="text-xs text-gray-500">{cell.orderCount} đơn</div>
                    </div>
                  </div>
                  <div className="font-bold text-green-600 text-right">
                    {cell.revenue.toLocaleString("vi-VN")} đ
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Desktop Grid View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto table-mobile-scroll pb-2">
          <div className="min-w-[1120px] space-y-1">
            {/* Header: Hours */}
            <div className="flex items-center">
              <div className="w-16 shrink-0 text-xs text-gray-400 font-bold text-center">Thứ</div>
              <div className="flex-1 gap-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                  <div key={h} className="text-center text-[10px] text-gray-400 font-medium">
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
                  <div className="w-16 shrink-0 text-sm font-semibold text-gray-700">
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
                          title={`${day}, ${hour}h: ${cell.revenue.toLocaleString("vi-VN")} đ (${cell.orderCount} đơn)`}
                          className="rounded-md border border-gray-100/50 flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow-sm cursor-pointer"
                          style={{
                            backgroundColor: cell.revenue > 0 ? `rgba(79, 70, 229, ${scaledOpacity})` : '#f9fafb',
                            color: scaledOpacity > 0.5 ? '#ffffff' : '#1e1b4b',
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
        <div className="mt-4 flex items-center justify-end gap-3 text-xs text-gray-500 hidden md:flex">
          <span>Doanh thu thấp</span>
          <div className="flex gap-1 h-4">
            <div className="w-6 rounded" style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}></div>
            <div className="w-6 rounded" style={{ backgroundColor: 'rgba(79, 70, 229, 0.25)' }}></div>
            <div className="w-6 rounded" style={{ backgroundColor: 'rgba(79, 70, 229, 0.55)' }}></div>
            <div className="w-6 rounded" style={{ backgroundColor: 'rgba(79, 70, 229, 0.9)' }}></div>
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
        {/* Product Table */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Chi tiết Sản lượng</h3>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
              Tổng: {totalQtyAll} ly
            </span>
          </div>
          <div className="hidden md:block overflow-x-auto max-h-[528px] overflow-y-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white text-gray-400 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-4 py-3">Món</th>
                  {uniqueSizes.map(size => (
                    <th key={size} className="px-4 py-3 text-right">Size {size}</th>
                  ))}
                  <th className="px-4 py-3 text-right text-gray-700">Tổng SL</th>
                  <th className="px-4 py-3 text-right text-gray-700">Tổng Thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bestSellers.length === 0 ? (
                  <tr><td colSpan={uniqueSizes.length + 3} className="text-center py-8 text-gray-400">Không có giao dịch</td></tr>
                ) : (
                  bestSellers.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                      {uniqueSizes.map(size => (
                        <td key={size} className="px-4 py-3 text-right font-medium text-gray-500">
                          {item.sizes[size] ? item.sizes[size] : '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{item.totalQty}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{Math.round(item.totalRevenue).toLocaleString("vi-VN")} đ</td>
                    </tr>
                  ))
                )}
              </tbody>
              {bestSellers.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0 z-10 font-bold text-gray-900 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                  <tr>
                    <td className="px-4 py-3">Tổng cộng</td>
                    {uniqueSizes.map(size => (
                      <td key={size} className="px-4 py-3 text-right">
                        {totalQtyBySize[size] > 0 ? totalQtyBySize[size].toLocaleString("vi-VN") : "-"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">{totalQtyAll.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3 text-right text-green-700">{Math.round(totalRevenueAll).toLocaleString("vi-VN")} đ</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[528px] bg-gray-50/30">
            {bestSellers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Không có giao dịch</div>
            ) : (
              bestSellers.map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-bold text-gray-900">{item.name}</div>
                    <div className="font-bold text-green-600 shrink-0">{Math.round(item.totalRevenue).toLocaleString("vi-VN")} đ</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Tổng SL:</span>
                      <span className="font-semibold text-gray-800">{item.totalQty}</span>
                    </div>
                    {uniqueSizes.filter(size => item.sizes[size]).map(size => (
                      <div key={size} className="flex items-center gap-1 text-xs">
                        <span className="text-gray-400">Size {size}:</span>
                        <span className="font-medium text-gray-700">{item.sizes[size]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            {bestSellers.length > 0 && (
              <div className="mt-2 pt-3 border-t border-gray-200 flex flex-col gap-2">
                <div className="flex justify-between items-center font-bold text-gray-900">
                  <span>Tổng cộng</span>
                  <span className="text-green-700">{Math.round(totalRevenueAll).toLocaleString("vi-VN")} đ</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                     <span className="text-gray-500">Tổng SL:</span>
                     <span className="font-bold text-gray-800">{totalQtyAll.toLocaleString("vi-VN")}</span>
                  </div>
                  {uniqueSizes.filter(size => totalQtyBySize[size] > 0).map(size => (
                    <div key={size} className="flex items-center gap-1 text-xs">
                      <span className="text-gray-400">Size {size}:</span>
                      <span className="font-medium text-gray-700">{totalQtyBySize[size].toLocaleString("vi-VN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toppings Table */}
        <div className="xl:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Top Topping Bán Chạy</h3>
          </div>
          <div className="hidden md:block overflow-x-auto max-h-[528px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-gray-400 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-4 py-3">Topping</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                  <th className="px-4 py-3 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bestToppings.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-gray-400">Không có topping nào</td></tr>
                ) : (
                  bestToppings.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-600">{item.qty}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{Math.round(item.revenue).toLocaleString("vi-VN")} đ</td>
                    </tr>
                  ))
                )}
              </tbody>
              {bestToppings.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0 z-10 font-bold text-gray-900 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                  <tr>
                    <td className="px-4 py-3">Tổng cộng</td>
                    <td className="px-4 py-3 text-right">{totalToppingQty.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3 text-right text-green-700">{Math.round(totalToppingRevenue).toLocaleString("vi-VN")} đ</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[528px] bg-gray-50/30">
            {bestToppings.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Không có topping nào</div>
            ) : (
              bestToppings.map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-bold text-gray-900">{item.name}</div>
                    <div className="font-bold text-green-600 shrink-0">{Math.round(item.revenue).toLocaleString("vi-VN")} đ</div>
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="text-gray-400">Số lượng:</span>
                    <span className="font-semibold text-gray-800">{item.qty}</span>
                  </div>
                </div>
              ))
            )}
            {bestToppings.length > 0 && (
              <div className="mt-2 pt-3 border-t border-gray-200 flex justify-between items-center font-bold text-gray-900">
                <div className="flex items-center gap-2">
                  <span>Tổng:</span>
                  <span>{totalToppingQty.toLocaleString("vi-VN")}</span>
                </div>
                <div className="text-green-700">{Math.round(totalToppingRevenue).toLocaleString("vi-VN")} đ</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
