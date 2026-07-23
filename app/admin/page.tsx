import { findAll, findAllNoCache, findAllWhere } from "@/lib/sheets_db";
import Link from "next/link";
import { ORDER_STATUS } from "@/lib/order-types";
import { breakdownRevenueByProduct } from "@/lib/report-v2-allocators";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { getSupabaseClient } from "@/lib/supabase";
import { Banknote, Receipt, TrendingUp, Coffee, Tag, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

const TrendBadge = ({ value }: { value: number | null }) => {
  if (value === null) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  const variant = isUp ? "success" : isDown ? "danger" : "neutral";
  const arrow = isUp ? "↑" : isDown ? "↓" : "−";
  return (
    <Badge variant={variant} className="gap-0.5 !text-[10px] !px-1.5 !py-0.5">
      <span>{arrow}</span> {Math.abs(value).toFixed(1)}%
    </Badge>
  );
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = getSupabaseClient();
  const [{ count: anomalousLedgerCount }, { count: anomalousRecipeCount }] = await Promise.all([
    supabase.from("backdated_ledger_events").select("*", { count: "exact", head: true }).eq("status", "PENDING").eq("is_anomalous", true),
    supabase.from("backdated_recipe_events").select("*", { count: "exact", head: true }).eq("status", "PENDING").eq("is_anomalous", true),
  ]);
  const anomalousBackdatedEventCount = (anomalousLedgerCount || 0) + (anomalousRecipeCount || 0);

  const filterParam = searchParams.filter as string || 'this_month';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  const todayStart = new Date(currentYear, currentMonth, currentDate);
  const yesterdayStart = new Date(currentYear, currentMonth, currentDate - 1);
  const sevenDayChartStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const diffDays = (d1: Date, d2: Date) => (d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);

  let isCurrent = (d: Date) => true;
  let isPrev = (d: Date) => false;
  // Lower bound for the Orders_V2/Order_Lines_V2 fetch below -- must be <=
  // the earliest date isCurrent/isPrev/the always-shown 7-day chart could
  // possibly need, or revenue silently under-counts. null means "all" (no
  // bound, fetch everything -- the only filter that genuinely needs it).
  let queryStartDate: Date | null = sevenDayChartStart;

  switch(filterParam) {
    case 'today':
      isCurrent = (d) => d >= todayStart;
      isPrev = (d) => d >= yesterdayStart && d < todayStart;
      queryStartDate = new Date(Math.min(yesterdayStart.getTime(), sevenDayChartStart.getTime()));
      break;
    case '7days':
      isCurrent = (d) => diffDays(now, d) <= 7;
      isPrev = (d) => { const diff = diffDays(now, d); return diff > 7 && diff <= 14; };
      queryStartDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      break;
    case '30days':
      isCurrent = (d) => diffDays(now, d) <= 30;
      isPrev = (d) => { const diff = diffDays(now, d); return diff > 30 && diff <= 60; };
      queryStartDate = new Date(now.getTime() - 61 * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      isCurrent = (d) => d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      isPrev = (d) => {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const limitDate = new Date(lastMonthYear, lastMonth, currentDate + 1);
        return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth && d < limitDate;
      };
      {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        queryStartDate = new Date(Math.min(new Date(lastMonthYear, lastMonth, 1).getTime(), sevenDayChartStart.getTime()));
      }
      break;
    case 'last_month':
      const lm = currentMonth === 0 ? 11 : currentMonth - 1;
      const lmy = currentMonth === 0 ? currentYear - 1 : currentYear;
      isCurrent = (d) => d.getFullYear() === lmy && d.getMonth() === lm;

      const prevLm = lm === 0 ? 11 : lm - 1;
      const prevLmy = lm === 0 ? lmy - 1 : lmy;
      isPrev = (d) => d.getFullYear() === prevLmy && d.getMonth() === prevLm;
      queryStartDate = new Date(Math.min(new Date(prevLmy, prevLm, 1).getTime(), sevenDayChartStart.getTime()));
      break;
    case 'this_year':
      isCurrent = (d) => d.getFullYear() === currentYear;
      isPrev = (d) => {
        const limitDate = new Date(currentYear - 1, currentMonth, currentDate + 1);
        return d.getFullYear() === currentYear - 1 && d < limitDate;
      };
      queryStartDate = new Date(Math.min(new Date(currentYear - 1, 0, 1).getTime(), sevenDayChartStart.getTime()));
      break;
    case 'last_year':
      isCurrent = (d) => d.getFullYear() === currentYear - 1;
      isPrev = (d) => d.getFullYear() === currentYear - 2;
      queryStartDate = new Date(Math.min(new Date(currentYear - 2, 0, 1).getTime(), sevenDayChartStart.getTime()));
      break;
    case 'all':
      isCurrent = (d) => true;
      isPrev = (d) => false;
      queryStartDate = null;
      break;
  }

  const dateFilter = queryStartDate ? { gte: { created_at: queryStartDate.toISOString() } } : {};

  const [brands, users, suppliers, v2Orders, v2Lines, products, variants, categories] = await Promise.all([
    findAll("Brands"),
    findAll("Users"),
    findAll("Suppliers"),
    queryStartDate ? findAllWhere("Orders_V2", dateFilter) : findAllNoCache("Orders_V2"),
    queryStartDate ? findAllWhere("Order_Lines_V2", dateFilter) : findAllNoCache("Order_Lines_V2"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Product_Categories")
  ]);

  // Coerce raw V2 row strings to typed shape with numeric fields
  function normalizeV2Order(row: any) {
    return {
      ...row,
      id: row.id,
      status: row.status,
      version: Number(row.version) || 1,
      created_at: row.created_at,
      staff_name: row.created_by_name || "",
      brand_id: row.brand_id,
      // For backward-compat with downstream dashboard logic
      total_amount: Number(row.net_total) || 0,
      net_total: Number(row.net_total) || 0,
      gross_total: Number(row.gross_total) || 0,
    };
  }

  const v2OrderIds = new Set(v2Orders.map((o: any) => o.id));
  const v2LinesForOrders = (v2Lines as any[])
    .filter((l: any) => v2OrderIds.has(l.order_id))
    .map((l: any) => ({
      ...l,
      qty: Number(l.qty) || 0,
      unit_price: Number(l.unit_price) || 0,
      gross_line_total: Number(l.gross_line_total) || 0,
      promo_discount: Number(l.promo_discount) || 0,
      manual_item_discount: Number(l.manual_item_discount) || 0,
      order_discount_allocation: Number(l.order_discount_allocation) || 0,
      net_line_total: Number(l.net_line_total) || 0,
    }));

  const validOrders = (v2Orders as any[])
    .filter((o: any) =>
      o.status === ORDER_STATUS.COMPLETED &&
      !(o.superseded_by && o.superseded_by !== "") &&
      o.created_at,
    )
    .map(normalizeV2Order);

  const currOrders = validOrders.filter((o:any) => isCurrent(new Date(o.created_at)));
  const prevOrders = validOrders.filter((o:any) => isPrev(new Date(o.created_at)));

  const currRev = currOrders.reduce((sum:number, o:any) => sum + (parseFloat(o.total_amount) || 0), 0);
  const prevRev = prevOrders.reduce((sum:number, o:any) => sum + (parseFloat(o.total_amount) || 0), 0);
  
  const currOrdCount = currOrders.length;
  const prevOrdCount = prevOrders.length;
  
  const currAOV = currOrdCount > 0 ? currRev / currOrdCount : 0;
  const prevAOV = prevOrdCount > 0 ? prevRev / prevOrdCount : 0;
  
  // Logic đếm ly: Bỏ qua danh mục có chữ "topping"
  const toppingCats = categories.filter((c:any) => c.name?.toLowerCase().includes('topping')).map((c:any) => c.id);
  const getCups = (ords:any[]) => {
    const ids = ords.map(o => o.id);
    const lines = v2LinesForOrders.filter((l:any) => ids.includes(l.order_id));
    return lines.reduce((sum:number, line:any) => {
      const p = products.find((p:any) => p.id === line.product_id);
      if (p && toppingCats.includes(p.category_id)) return sum;
      return sum + Number(line.qty || 0);
    }, 0);
  };
  
  const currCups = getCups(currOrders);
  const prevCups = getCups(prevOrders);
  
  const currAvgCup = currCups > 0 ? currRev / currCups : 0;
  const prevAvgCup = prevCups > 0 ? prevRev / prevCups : 0;
  
  const activeSuppliers = suppliers.filter((s:any) => s.status !== 'INACTIVE').length;

  const calcTrend = (curr: number, prev: number) => {
    if (filterParam === 'all' || prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };

  const trends = {
    rev: calcTrend(currRev, prevRev),
    ord: calcTrend(currOrdCount, prevOrdCount),
    aov: calcTrend(currAOV, prevAOV),
    cups: calcTrend(currCups, prevCups),
    avgCup: calcTrend(currAvgCup, prevAvgCup)
  };
  
  const stats = [
    { title: "Tổng Doanh Thu", value: formatNumber(currRev), icon: <Banknote className="w-5 h-5" />, color: "bg-primary-soft text-primary", trend: trends.rev },
    { title: "Đơn hàng hoàn tất", value: currOrdCount.toString(), icon: <Receipt className="w-5 h-5" />, color: "bg-surface-secondary text-text-secondary", trend: trends.ord },
    { title: "TB Đơn (AOV)", value: formatNumber(Math.round(currAOV)), icon: <TrendingUp className="w-5 h-5" />, color: "bg-primary-soft text-primary", trend: trends.aov },
    { title: "Tổng Ly Đã Bán", value: currCups.toString(), icon: <Coffee className="w-5 h-5" />, color: "bg-surface-secondary text-text-secondary", trend: trends.cups },
    { title: "TB Ly", value: formatNumber(Math.round(currAvgCup)), icon: <Tag className="w-5 h-5" />, color: "bg-primary-soft text-primary", trend: trends.avgCup },
    { title: "Nhà cung cấp", value: activeSuppliers.toString(), icon: <Building2 className="w-5 h-5" />, color: "bg-surface-secondary text-text-secondary", trend: undefined },
  ];

  const currOrderIds = new Set(currOrders.map((o: any) => o.id));
  const currLines = v2LinesForOrders.filter((l: any) => currOrderIds.has(l.order_id));
  const currProducts = breakdownRevenueByProduct(currOrders, currLines);
  const bestSellers = currProducts
    .filter(p => !p.product_id.startsWith("MOD:"))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
    .map(p => ({
      name: p.product_name,
      qty: p.qty,
      revenue: p.revenue
    }));

  const salesByDate: Record<string, number> = {};
  for(let i=6; i>=0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    salesByDate[d.toLocaleDateString("en-GB")] = 0;
  }

  const allCompletedOrders = validOrders;
  allCompletedOrders.forEach((o:any) => {
    if(!o.created_at) return;
    const dateStr = new Date(o.created_at).toLocaleDateString("en-GB");
    if(salesByDate[dateStr] !== undefined) {
      salesByDate[dateStr] += Number(o.total_amount || 0);
    }
  });

  const chartData = Object.entries(salesByDate).map(([date, amount]) => ({
    date: date.substring(0, 5),
    amount
  }));
  const maxAmount = Math.max(...chartData.map(d => d.amount), 1);

  return (
    <div className="space-y-6">
      {anomalousBackdatedEventCount > 0 && (
        <Link href="/admin/audit/backdated-ledger?status=PENDING" className="block">
          <Alert variant="warning" title="Cần xem lại: điều chỉnh giá vốn bất thường">
            Có {anomalousBackdatedEventCount} giao dịch backdate với mức điều chỉnh lớn hơn bình thường,
            hệ thống đã tạm dừng không tự áp dụng. Bấm để xem chi tiết.
          </Alert>
        </Link>
      )}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Tổng quan Hệ thống</h1>
          <p className="text-text-secondary mt-1">Xin chào, đây là tình hình kinh doanh hiện tại của bạn.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
          <div className="bg-surface-card p-1 rounded-lg border border-border flex flex-wrap text-sm shadow-sm gap-1 max-w-full">
            <Link href="?filter=today" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'today' ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-page'}`}>Hôm nay</Link>
            <Link href="?filter=7days" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === '7days' ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-page'}`}>7 ngày</Link>
            <Link href="?filter=30days" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === '30days' || filterParam === '30' ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-page'}`}>30 ngày</Link>
            <Link href="?filter=this_month" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'this_month' ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-page'}`}>Tháng này</Link>
            <Link href="?filter=last_month" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'last_month' ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-page'}`}>Tháng trước</Link>
            <Link href="?filter=this_year" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'this_year' ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-page'}`}>Năm nay</Link>
            <Link href="?filter=last_year" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'last_year' ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-page'}`}>Năm trước</Link>
            <Link href="?filter=all" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'all' ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-page'}`}>Tất cả</Link>
          </div>
          <div className="text-sm font-medium text-text-muted bg-surface-card px-4 py-2.5 rounded-lg border border-border shadow-sm hidden 2xl:block whitespace-nowrap">
            Cập nhật lúc: {new Date().toLocaleTimeString('vi-VN')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-surface-card rounded-card p-4 shadow-sm border border-border hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${stat.color}`}>
                {stat.icon}
              </div>
              {stat.trend !== undefined && <TrendBadge value={stat.trend} />}
            </div>
            <div>
              <h3 className="text-text-secondary text-xs font-medium mb-1 line-clamp-1">{stat.title}</h3>
              <p className="text-lg md:text-xl font-bold text-text-primary truncate" title={stat.value}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-surface-card rounded-card p-6 shadow-sm border border-border h-96 flex flex-col">
          <h3 className="font-bold text-text-primary mb-6">Doanh thu 7 ngày gần nhất</h3>
          <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 pb-6 mt-auto">
            {chartData.map((d, i) => {
              const heightPercent = (d.amount / maxAmount) * 100;
              return (
                <div key={i} className="flex flex-col items-center flex-1 group">
                  <div className="text-xs text-text-secondary mb-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    {Math.round(d.amount / 1000).toLocaleString("vi-VN")}k
                  </div>
                  <div className="w-full bg-primary-soft rounded-t-lg relative flex items-end h-[200px]">
                    <div 
                      className="w-full bg-primary rounded-t-lg transition-[height] duration-500 ease-out"
                      style={{ height: `${heightPercent}%`, minHeight: d.amount > 0 ? '4px' : '0' }}
                    ></div>
                  </div>
                  <div className="text-xs text-text-muted mt-3 font-medium">{d.date}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="bg-surface-card rounded-card p-6 shadow-sm border border-border overflow-hidden flex flex-col h-96">
          <h3 className="font-bold text-text-primary mb-4">Top 5 Bán chạy nhất (Theo bộ lọc)</h3>
          {bestSellers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">Chưa có dữ liệu bán hàng</div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {bestSellers.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center text-sm shrink-0">
                      #{i + 1}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary text-sm line-clamp-1" title={item.name}>{item.name}</div>
                      <div className="text-xs text-text-secondary">{formatNumber(item.revenue)}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-text-primary bg-page px-2 py-1 rounded whitespace-nowrap">
                    {item.qty} ly
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
