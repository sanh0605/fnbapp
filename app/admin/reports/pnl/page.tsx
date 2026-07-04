import { getPnLDataV2, getPromotionPerformanceV2 } from "../actions";
import { findAll } from "@/lib/sheets_db";
import SalesFilter from "@/components/SalesFilter";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const defaultStartDate = new Date();
  defaultStartDate.setDate(1);
  defaultStartDate.setHours(0,0,0,0);
  
  const defaultEndDate = new Date();
  defaultEndDate.setHours(23,59,59,999);

  const startParam = Array.isArray(searchParams?.start) ? searchParams.start[0] : (searchParams?.start || defaultStartDate.toISOString());
  const endParam = Array.isArray(searchParams?.end) ? searchParams.end[0] : (searchParams?.end || defaultEndDate.toISOString());
  const brandId = Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : searchParams?.brandId;
  const staffName = Array.isArray(searchParams?.staffName) ? searchParams.staffName[0] : searchParams?.staffName;
  const categoryId = Array.isArray(searchParams?.categoryId) ? searchParams.categoryId[0] : searchParams?.categoryId;

  const filters = {
    startDate: startParam,
    endDate: endParam,
    brandId,
    staffName,
    categoryId
  };

  const [data, promoPerf, brands, users, categories] = await Promise.all([
    getPnLDataV2(filters),
    getPromotionPerformanceV2(filters),
    findAll("Brands"),
    findAll("Users"),
    findAll("Product_Categories")
  ]);

  const productProfitAnalysis = data.productProfitAnalysis.filter(p => !p.product_id.startsWith("MOD:"));
  const toppingProfitAnalysis = data.productProfitAnalysis.filter(p => p.product_id.startsWith("MOD:"));

  return (
    <div className="space-y-6">
      <SalesFilter
        brands={brands}
        users={users}
        categories={categories}
        title="Báo cáo Lãi Lỗ (P&L)"
        subtitle="Tổng hợp Doanh thu và Giá vốn (COGS, chuẩn MAC — weighted average cost) dựa trên dữ liệu V2."
      />

      {/* Claude code — spec compliance: note MAC clarification */}
      <div className="bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 text-xs">
        <strong>Lưu ý COGS:</strong> Giá vốn dùng chuẩn MAC (Moving Average Cost) được lưu tại thời điểm tạo/sửa đơn. Chi tiết theo nguyên liệu chỉ mang tính tham khảo (FIFO informational). Xem <code>docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md</code>.
      </div>

      {data.v2OrderCount === 0 && (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200">
          <strong>Lưu ý:</strong> Không có đơn hàng V2 nào trong khoảng thời gian này. Báo cáo lãi lỗ đã được chuyển sang dữ liệu V2 (từ 19/06/2026). Dữ liệu V1 cũ không còn hiển thị ở đây.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* DOANH THU */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Tổng Doanh Thu</p>
              <h3 className="text-3xl font-black text-gray-900">{data.totalRevenue.toLocaleString('vi-VN')} đ</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl" aria-hidden="true">
              💰
            </div>
          </div>
          <div className="text-sm font-medium text-gray-500">
            Từ <span className="text-gray-800 font-bold">{data.orderCount}</span> đơn hàng hoàn thành
          </div>
        </div>

        {/* GIÁ VỐN */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Giá Vốn (COGS)</p>
              <h3 className="text-3xl font-black text-red-600">{data.totalCOGS.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</h3>
            </div>
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-xl" aria-hidden="true">
              📉
            </div>
          </div>
          <div className="text-sm font-medium text-gray-500">
            Chi phí nguyên vật liệu tiêu hao
          </div>
        </div>

        {/* LỢI NHUẬN GỘP */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-sm border border-emerald-500 p-6 flex flex-col justify-between text-white hover:shadow-lg hover:shadow-emerald-200 transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-emerald-100 uppercase tracking-wider mb-1">Lợi Nhuận Gộp</p>
              <h3 className="text-3xl font-black">{data.grossProfit.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</h3>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl" aria-hidden="true">
              📈
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-emerald-100">Biên lợi nhuận gộp (Margin):</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-white text-emerald-700 shadow-sm">
              {data.margin.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* PHÂN TÍCH TỶ TRỌNG GIÁ VỐN */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Phân Tích Tỷ Trọng Giá Vốn Hàng Bán</h3>
          <p className="text-sm text-gray-500">Chi tiết chi phí tiêu hao của từng loại nguyên liệu gốc.</p>
        </div>
        
        {data.cogsDetails.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-gray-500">Chưa có dữ liệu tiêu hao nguyên liệu từ bán hàng.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4">Tên Nguyên Liệu</th>
                  <th className="px-6 py-4 text-right">Khối Lượng Tiêu Hao</th>
                  <th className="px-6 py-4 text-right">Giá Nhập Bình Quân (MAC)</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-900">Tổng Giá Vốn</th>
                  <th className="px-6 py-4 text-right">% Tỷ Trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.cogsDetails.map((item, idx) => {
                  const percentage = data.totalCOGS > 0 ? (item.cogs / data.totalCOGS) * 100 : 0;
                  const mac = item.qty > 0 ? item.cogs / item.qty : 0;
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-800">{item.name}</td>
                      <td className="px-6 py-4 text-right text-orange-600 font-medium">
                        {item.qty.toLocaleString('vi-VN')} {item.unitName}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        {mac.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ / {item.unitName}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">
                        {item.cogs.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium text-gray-700">{percentage.toFixed(1)}%</span>
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HIỆU QUẢ KINH DOANH TỪNG MÓN */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Phân Tích Hiệu Quả Kinh Doanh Từng Món</h3>
          <p className="text-sm text-gray-500">Chi tiết doanh thu, giá vốn và biên lợi nhuận của từng món bán ra.</p>
        </div>
        
        {productProfitAnalysis.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-gray-500">Chưa có dữ liệu bán hàng.</p>
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4">Tên Món</th>
                  <th className="px-6 py-4 text-center">Số Lượng Bán</th>
                  <th className="px-6 py-4 text-right">Doanh Thu</th>
                  <th className="px-6 py-4 text-right">Tổng Giá Vốn</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-900">Lợi Nhuận Gộp</th>
                  <th className="px-6 py-4 text-right">% Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productProfitAnalysis.map((item:any, idx:number) => {
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-800">{item.product_name}</td>
                      <td className="px-6 py-4 text-center text-blue-600 font-medium">
                        {item.qty.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        {item.revenue.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ
                      </td>
                      <td className="px-6 py-4 text-right text-red-600">
                        {item.cogs.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                        {item.grossProfit.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded font-bold text-xs ${
                          item.marginPct >= 50 ? 'bg-emerald-100 text-emerald-700' :
                          item.marginPct >= 30 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.marginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[60vh] bg-gray-50/30">
            {productProfitAnalysis.map((item:any, idx:number) => (
              <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-gray-900">{item.product_name}</div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded font-bold text-xs ${
                      item.marginPct >= 50 ? 'bg-emerald-100 text-emerald-700' :
                      item.marginPct >= 30 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.marginPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400">Số Lượng</span>
                    <span className="font-semibold text-blue-600">{item.qty.toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400">Doanh Thu</span>
                    <span className="font-semibold text-gray-800">{item.revenue.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400">Giá Vốn</span>
                    <span className="font-semibold text-red-600">{item.cogs.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400">LN Gộp</span>
                    <span className="font-bold text-emerald-600">{item.grossProfit.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* HIỆU QUẢ KINH DOANH TOPPING */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Phân Tích Hiệu Quả Kinh Doanh Topping</h3>
          <p className="text-sm text-gray-500">Chi tiết doanh thu, giá vốn và biên lợi nhuận của từng topping bán ra.</p>
        </div>
        
        {toppingProfitAnalysis.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-gray-500">Chưa có dữ liệu bán hàng topping.</p>
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 border-b border-gray-100 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4">Tên Topping</th>
                  <th className="px-6 py-4 text-center">Số Lượng Bán</th>
                  <th className="px-6 py-4 text-right">Doanh Thu</th>
                  <th className="px-6 py-4 text-right">Tổng Giá Vốn</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-900">Lợi Nhuận Gộp</th>
                  <th className="px-6 py-4 text-right">% Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {toppingProfitAnalysis.map((item:any, idx:number) => {
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-800">{item.product_name}</td>
                      <td className="px-6 py-4 text-center text-blue-600 font-medium">
                        {item.qty.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        {item.revenue.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ
                      </td>
                      <td className="px-6 py-4 text-right text-red-600">
                        {item.cogs.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                        {item.grossProfit.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded font-bold text-xs ${
                          item.marginPct >= 50 ? 'bg-emerald-100 text-emerald-700' :
                          item.marginPct >= 30 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.marginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[60vh] bg-gray-50/30">
            {toppingProfitAnalysis.map((item:any, idx:number) => (
              <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-gray-900">{item.product_name}</div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded font-bold text-xs ${
                      item.marginPct >= 50 ? 'bg-emerald-100 text-emerald-700' :
                      item.marginPct >= 30 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.marginPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400">Số Lượng</span>
                    <span className="font-semibold text-blue-600">{item.qty.toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400">Doanh Thu</span>
                    <span className="font-semibold text-gray-800">{item.revenue.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400">Giá Vốn</span>
                    <span className="font-semibold text-red-600">{item.cogs.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400">LN Gộp</span>
                    <span className="font-bold text-emerald-600">{item.grossProfit.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* HIỆU QUẢ CHƯƠNG TRÌNH KHUYẾN MÃI */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Hiệu Quả Chương Trình Khuyến Mãi</h3>
            <p className="text-sm text-gray-500">Thống kê số lần dùng, tổng chiết khấu đã chi và doanh thu thực tế mang về.</p>
          </div>
        </div>

        {promoPerf.length === 0 ? (
          <div className="text-center py-12 px-4 text-gray-400">
            Không có chương trình khuyến mãi nào được áp dụng trong khoảng thời gian này.
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {/* Visual Bar Chart Comparison */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider">So sánh doanh số do Khuyến mãi mang lại</h4>
              <div className="space-y-3">
                {promoPerf.map((p, idx) => {
                  const maxRevenue = Math.max(...promoPerf.map(x => x.totalRevenue), 1);
                  const widthPct = (p.totalRevenue / maxRevenue) * 100;
                  return (
                    <div key={p.promotion_id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-700">
                        <span>{p.name} {p.code ? `(${p.code})` : ""}</span>
                        <span>{p.totalRevenue.toLocaleString("vi-VN")} đ</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-[width] duration-500" 
                            style={{ width: `${widthPct}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-bold text-gray-500 w-16 text-right shrink-0">
                          {p.appliedCount} lượt
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table Details */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-sm text-gray-600 whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Tên Chương Trình</th>
                    <th className="px-6 py-4">Mã</th>
                    <th className="px-6 py-4">Loại</th>
                    <th className="px-6 py-4 text-center">Số Lượt Áp Dụng</th>
                    <th className="px-6 py-4 text-right">Tổng Tiền Chiết Khấu</th>
                    <th className="px-6 py-4 text-right font-bold text-gray-900">Doanh Thu Mang Về</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {promoPerf.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-bold text-gray-800">{p.name}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs">
                          {p.code || "TỰ ĐỘNG"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 capitalize">
                        {p.type?.toLowerCase().replace("_", " ") || "Chiết khấu"}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-indigo-600">{p.appliedCount}</td>
                      <td className="px-6 py-4 text-right text-red-600 font-medium">
                        {p.totalDiscount.toLocaleString("vi-VN")} đ
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                        {p.totalRevenue.toLocaleString("vi-VN")} đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
