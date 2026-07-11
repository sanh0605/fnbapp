import { getPnLDataV2, getPromotionPerformanceV2 } from "../actions";
import { findAll } from "@/lib/sheets_db";
import SalesFilter from "@/components/SalesFilter";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertCircle, Banknote, TrendingDown, TrendingUp } from "lucide-react";

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
      <div className="bg-primary-soft text-primary p-3 rounded-xl border border-primary/20 text-xs">
        <strong>Lưu ý COGS:</strong> Giá vốn dùng chuẩn MAC (Moving Average Cost) được lưu tại thời điểm tạo/sửa đơn. Chi tiết theo nguyên liệu chỉ mang tính tham khảo (FIFO informational). Xem <code>docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md</code>.
      </div>

      {data.v2OrderCount === 0 && (
        <div className="bg-warning-soft text-warning p-4 rounded-xl border border-warning/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>Lưu ý:</strong> Không có đơn hàng V2 nào trong khoảng thời gian này. Báo cáo lãi lỗ đã được chuyển sang dữ liệu V2 (từ 19/06/2026). Dữ liệu V1 cũ không còn hiển thị ở đây.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* DOANH THU */}
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Tổng Doanh Thu</p>
              <h3 className="text-3xl font-black text-text-primary">{formatNumber(data.totalRevenue)}</h3>
            </div>
            <div className="w-12 h-12 bg-primary-soft text-primary rounded-full flex items-center justify-center text-xl" aria-hidden="true">
              <Banknote className="w-6 h-6" />
            </div>
          </div>
          <div className="text-sm font-medium text-text-secondary">
            Từ <span className="text-text-primary font-bold">{data.orderCount}</span> đơn hàng hoàn thành
          </div>
        </div>

        {/* GIÁ VỐN */}
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Giá Vốn (COGS)</p>
              <h3 className="text-3xl font-black text-danger">{formatNumber(data.totalCOGS)}</h3>
            </div>
            <div className="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center text-xl" aria-hidden="true">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
          <div className="text-sm font-medium text-text-secondary">
            Chi phí nguyên vật liệu tiêu hao
          </div>
        </div>

        {/* LỢI NHUẬN GỘP */}
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Lợi Nhuận Gộp</p>
              <h3 className="text-3xl font-black text-text-primary">{formatNumber(data.grossProfit)}</h3>
            </div>
            <div className="w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center text-xl" aria-hidden="true">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-secondary">Biên lợi nhuận gộp (Margin):</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold bg-success/10 text-success shadow-sm">
              {data.margin.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* PHÂN TÍCH TỶ TRỌNG GIÁ VỐN */}
      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">Phân Tích Tỷ Trọng Giá Vốn Hàng Bán</h3>
          <p className="text-sm text-text-secondary">Chi tiết chi phí tiêu hao của từng loại nguyên liệu gốc.</p>
        </div>
        
        {data.cogsDetails.length === 0 ? (
          <EmptyState 
            icon={<AlertCircle className="w-8 h-8 text-text-muted" />}
            title="Chưa có dữ liệu tiêu hao"
            description="Chưa có dữ liệu tiêu hao nguyên liệu từ bán hàng."
          />
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead className="bg-page text-text-muted font-medium sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4">Tên Nguyên Liệu</th>
                  <th className="px-6 py-4 text-right">Khối Lượng Tiêu Hao</th>
                  <th className="px-6 py-4 text-right">Giá Nhập Bình Quân (MAC)</th>
                  <th className="px-6 py-4 text-right font-bold text-text-primary">Tổng Giá Vốn</th>
                  <th className="px-6 py-4 text-right">% Tỷ Trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.cogsDetails.map((item, idx) => {
                  const percentage = data.totalCOGS > 0 ? (item.cogs / data.totalCOGS) * 100 : 0;
                  const mac = item.qty > 0 ? item.cogs / item.qty : 0;
                  return (
                    <tr key={idx} className="hover:bg-page transition">
                      <td className="px-6 py-4 font-bold text-text-primary">{item.name}</td>
                      <td className="px-6 py-4 text-right text-warning font-medium">
                        {item.qty.toLocaleString('vi-VN')} {item.unitName}
                      </td>
                      <td className="px-6 py-4 text-right text-text-secondary">
                        {formatNumber(mac)} / {item.unitName}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-danger">
                        {formatNumber(item.cogs)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium text-text-primary">{percentage.toFixed(1)}%</span>
                          <div className="w-16 h-2 bg-page rounded-full overflow-hidden border border-border/50">
                            <div className="h-full bg-danger rounded-full" style={{ width: `${percentage}%` }}></div>
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
      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">Phân Tích Hiệu Quả Kinh Doanh Từng Món</h3>
          <p className="text-sm text-text-secondary">Chi tiết doanh thu, giá vốn và biên lợi nhuận của từng món bán ra.</p>
        </div>
        
        {productProfitAnalysis.length === 0 ? (
          <EmptyState 
            title="Chưa có dữ liệu"
            description="Chưa có dữ liệu bán hàng."
          />
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead className="bg-page text-text-muted font-medium sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4">Tên Món</th>
                  <th className="px-6 py-4 text-center">Số Lượng Bán</th>
                  <th className="px-6 py-4 text-right">Doanh Thu</th>
                  <th className="px-6 py-4 text-right">Tổng Giá Vốn</th>
                  <th className="px-6 py-4 text-right font-bold text-text-primary">Lợi Nhuận Gộp</th>
                  <th className="px-6 py-4 text-right">% Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {productProfitAnalysis.map((item:any, idx:number) => {
                  return (
                    <tr key={idx} className="hover:bg-page transition">
                      <td className="px-6 py-4 font-bold text-text-primary">{item.product_name}</td>
                      <td className="px-6 py-4 text-center text-primary font-medium">
                        {item.qty.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-right text-text-secondary">
                        {formatNumber(item.revenue)}
                      </td>
                      <td className="px-6 py-4 text-right text-danger">
                        {formatNumber(item.cogs)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-success">
                        {formatNumber(item.grossProfit)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant={
                          item.marginPct >= 50 ? 'success' :
                          item.marginPct >= 30 ? 'warning' :
                          'danger'
                        }>
                          {item.marginPct.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[60vh] bg-page/50">
            {productProfitAnalysis.map((item:any, idx:number) => (
              <div key={idx} className="bg-surface-card rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-text-primary">{item.product_name}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      item.marginPct >= 50 ? 'success' :
                      item.marginPct >= 30 ? 'warning' :
                      'danger'
                    }>
                      {item.marginPct.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-xs text-text-muted">Số Lượng</span>
                    <span className="font-semibold text-primary">{item.qty.toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-text-muted">Doanh Thu</span>
                    <span className="font-semibold text-text-primary">{formatNumber(item.revenue)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-text-muted">Giá Vốn</span>
                    <span className="font-semibold text-danger">{formatNumber(item.cogs)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-text-muted">LN Gộp</span>
                    <span className="font-bold text-success">{formatNumber(item.grossProfit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* HIỆU QUẢ KINH DOANH TOPPING */}
      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">Phân Tích Hiệu Quả Kinh Doanh Topping</h3>
          <p className="text-sm text-text-secondary">Chi tiết doanh thu, giá vốn và biên lợi nhuận của từng topping bán ra.</p>
        </div>
        
        {toppingProfitAnalysis.length === 0 ? (
          <EmptyState 
            title="Chưa có dữ liệu"
            description="Chưa có dữ liệu bán hàng topping."
          />
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead className="bg-page text-text-muted font-medium sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4">Tên Topping</th>
                  <th className="px-6 py-4 text-center">Số Lượng Bán</th>
                  <th className="px-6 py-4 text-right">Doanh Thu</th>
                  <th className="px-6 py-4 text-right">Tổng Giá Vốn</th>
                  <th className="px-6 py-4 text-right font-bold text-text-primary">Lợi Nhuận Gộp</th>
                  <th className="px-6 py-4 text-right">% Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {toppingProfitAnalysis.map((item:any, idx:number) => {
                  return (
                    <tr key={idx} className="hover:bg-page transition">
                      <td className="px-6 py-4 font-bold text-text-primary">{item.product_name}</td>
                      <td className="px-6 py-4 text-center text-primary font-medium">
                        {item.qty.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 text-right text-text-secondary">
                        {formatNumber(item.revenue)}
                      </td>
                      <td className="px-6 py-4 text-right text-danger">
                        {formatNumber(item.cogs)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-success">
                        {formatNumber(item.grossProfit)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge variant={
                          item.marginPct >= 50 ? 'success' :
                          item.marginPct >= 30 ? 'warning' :
                          'danger'
                        }>
                          {item.marginPct.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto max-h-[60vh] bg-page/50">
            {toppingProfitAnalysis.map((item:any, idx:number) => (
              <div key={idx} className="bg-surface-card rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-text-primary">{item.product_name}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      item.marginPct >= 50 ? 'success' :
                      item.marginPct >= 30 ? 'warning' :
                      'danger'
                    }>
                      {item.marginPct.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-xs text-text-muted">Số Lượng</span>
                    <span className="font-semibold text-primary">{item.qty.toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-text-muted">Doanh Thu</span>
                    <span className="font-semibold text-text-primary">{formatNumber(item.revenue)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-text-muted">Giá Vốn</span>
                    <span className="font-semibold text-danger">{formatNumber(item.cogs)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-text-muted">LN Gộp</span>
                    <span className="font-bold text-success">{formatNumber(item.grossProfit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* HIỆU QUẢ CHƯƠNG TRÌNH KHUYẾN MÃI */}
      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border bg-page flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Hiệu Quả Chương Trình Khuyến Mãi</h3>
            <p className="text-sm text-text-secondary">Thống kê số lần dùng, tổng chiết khấu đã chi và doanh thu thực tế mang về.</p>
          </div>
        </div>

        {promoPerf.length === 0 ? (
          <EmptyState 
            title="Không có khuyến mãi"
            description="Không có chương trình khuyến mãi nào được áp dụng trong khoảng thời gian này."
          />
        ) : (
          <div className="p-6 space-y-8">
            {/* Visual Bar Chart Comparison */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-text-primary uppercase tracking-wider">So sánh doanh số do Khuyến mãi mang lại</h4>
              <div className="space-y-3">
                {promoPerf.map((p, idx) => {
                  const maxRevenue = Math.max(...promoPerf.map(x => x.totalRevenue), 1);
                  const widthPct = (p.totalRevenue / maxRevenue) * 100;
                  return (
                    <div key={p.promotion_id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-text-primary">
                        <span>{p.name} {p.code ? `(${p.code})` : ""}</span>
                        <span>{formatNumber(p.totalRevenue)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3.5 bg-page rounded-full overflow-hidden border border-border/50">
                          <div 
                            className="h-full bg-primary rounded-full transition-[width] duration-500" 
                            style={{ width: `${widthPct}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-bold text-text-muted w-16 text-right shrink-0">
                          {p.appliedCount} lượt
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table Details */}
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
                <thead className="bg-page text-text-muted font-medium border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Tên Chương Trình</th>
                    <th className="px-6 py-4">Mã</th>
                    <th className="px-6 py-4">Loại</th>
                    <th className="px-6 py-4 text-center">Số Lượt Áp Dụng</th>
                    <th className="px-6 py-4 text-right">Tổng Tiền Chiết Khấu</th>
                    <th className="px-6 py-4 text-right font-bold text-text-primary">Doanh Thu Mang Về</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {promoPerf.map((p, idx) => (
                    <tr key={idx} className="hover:bg-page transition">
                      <td className="px-6 py-4 font-bold text-text-primary">{p.name}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono bg-page text-text-primary px-2 py-0.5 rounded text-xs border border-border/50">
                          {p.code || "TỰ ĐỘNG"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-text-muted capitalize">
                        {p.type?.toLowerCase().replace("_", " ") || "Chiết khấu"}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-primary">{p.appliedCount}</td>
                      <td className="px-6 py-4 text-right text-danger font-medium">
                        {formatNumber(p.totalDiscount)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-success">
                        {formatNumber(p.totalRevenue)}
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
