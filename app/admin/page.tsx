import { findAll } from "@/lib/sheets_db";
import Link from "next/link";

const TrendBadge = ({ value }: { value: number | null }) => {
  if (value === null) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  const color = isUp ? "text-green-700 bg-green-100" : isDown ? "text-red-700 bg-red-100" : "text-gray-600 bg-gray-100";
  const arrow = isUp ? "↑" : isDown ? "↓" : "−";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap ${color}`}>
      <span>{arrow}</span> {Math.abs(value).toFixed(1)}%
    </span>
  );
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [brands, users, suppliers, orders, orderLines, products, variants, categories] = await Promise.all([
    findAll("Brands"),
    findAll("Users"),
    findAll("Suppliers"),
    findAll("Orders"),
    findAll("Order_Lines"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Product_Categories")
  ]);

  const filterParam = searchParams.filter as string || 'this_month';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  
  const todayStart = new Date(currentYear, currentMonth, currentDate);
  const yesterdayStart = new Date(currentYear, currentMonth, currentDate - 1);
  
  const diffDays = (d1: Date, d2: Date) => (d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
  
  let isCurrent = (d: Date) => true;
  let isPrev = (d: Date) => false;
  
  switch(filterParam) {
    case 'today':
      isCurrent = (d) => d >= todayStart;
      isPrev = (d) => d >= yesterdayStart && d < todayStart;
      break;
    case '7days':
      isCurrent = (d) => diffDays(now, d) <= 7;
      isPrev = (d) => { const diff = diffDays(now, d); return diff > 7 && diff <= 14; };
      break;
    case '30days':
      isCurrent = (d) => diffDays(now, d) <= 30;
      isPrev = (d) => { const diff = diffDays(now, d); return diff > 30 && diff <= 60; };
      break;
    case 'this_month':
      isCurrent = (d) => d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      isPrev = (d) => {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const limitDate = new Date(lastMonthYear, lastMonth, currentDate + 1); 
        return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth && d < limitDate;
      };
      break;
    case 'last_month':
      const lm = currentMonth === 0 ? 11 : currentMonth - 1;
      const lmy = currentMonth === 0 ? currentYear - 1 : currentYear;
      isCurrent = (d) => d.getFullYear() === lmy && d.getMonth() === lm;
      
      const prevLm = lm === 0 ? 11 : lm - 1;
      const prevLmy = lm === 0 ? lmy - 1 : lmy;
      isPrev = (d) => d.getFullYear() === prevLmy && d.getMonth() === prevLm;
      break;
    case 'this_year':
      isCurrent = (d) => d.getFullYear() === currentYear;
      isPrev = (d) => {
        const limitDate = new Date(currentYear - 1, currentMonth, currentDate + 1);
        return d.getFullYear() === currentYear - 1 && d < limitDate;
      };
      break;
    case 'last_year':
      isCurrent = (d) => d.getFullYear() === currentYear - 1;
      isPrev = (d) => d.getFullYear() === currentYear - 2;
      break;
    case 'all':
      isCurrent = (d) => true;
      isPrev = (d) => false;
      break;
  }
  
  const validOrders = orders.filter((o:any) => o.status === "COMPLETED" && o.created_at);
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
    const lines = orderLines.filter((l:any) => ids.includes(l.order_id));
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
    { title: "Tổng Doanh Thu", value: `${currRev.toLocaleString("vi-VN")} đ`, icon: "💰", color: "bg-green-100 text-green-700", trend: trends.rev },
    { title: "Đơn hàng hoàn tất", value: currOrdCount.toString(), icon: "🧾", color: "bg-blue-100 text-blue-700", trend: trends.ord },
    { title: "TB Đơn (AOV)", value: `${Math.round(currAOV).toLocaleString("vi-VN")} đ`, icon: "📈", color: "bg-indigo-100 text-indigo-700", trend: trends.aov },
    { title: "Tổng Ly Đã Bán", value: currCups.toString(), icon: "🥤", color: "bg-orange-100 text-orange-700", trend: trends.cups },
    { title: "TB Ly", value: `${Math.round(currAvgCup).toLocaleString("vi-VN")} đ`, icon: "🏷️", color: "bg-pink-100 text-pink-700", trend: trends.avgCup },
    { title: "Nhà cung cấp", value: activeSuppliers.toString(), icon: "🏢", color: "bg-purple-100 text-purple-700", trend: undefined },
  ];

  const productSales: Record<string, { qty: number, revenue: number, name: string }> = {};
  
  orderLines.forEach((line:any) => {
    const order = currOrders.find((o:any) => o.id === line.order_id);
    if (!order) return;

    const key = `${line.product_id}_${line.variant_id}`;
    if (!productSales[key]) {
      const p = products.find((x:any) => x.id === line.product_id);
      const v = variants.find((x:any) => x.id === line.variant_id);
      const pName = p ? p.name : line.product_id;
      const vName = v ? v.name : '';
      productSales[key] = {
        name: vName ? `${pName} (${vName})` : pName,
        qty: 0,
        revenue: 0
      };
    }
    
    const qty = Number(line.qty || 0);
    const price = Number(line.unit_price || 0);
    productSales[key].qty += qty;
    productSales[key].revenue += qty * price;
  });

  const bestSellers = Object.values(productSales)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const salesByDate: Record<string, number> = {};
  for(let i=6; i>=0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    salesByDate[d.toLocaleDateString("en-GB")] = 0;
  }

  const allCompletedOrders = orders.filter((o:any) => o.status === "COMPLETED");
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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tổng quan Hệ thống</h1>
          <p className="text-gray-500 mt-1">Xin chào, đây là tình hình kinh doanh hiện tại của bạn.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
          <div className="bg-white p-1 rounded-lg border border-gray-200 flex flex-wrap text-sm shadow-sm gap-1 max-w-full">
            <Link href="?filter=today" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'today' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Hôm nay</Link>
            <Link href="?filter=7days" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === '7days' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>7 ngày</Link>
            <Link href="?filter=30days" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === '30days' || filterParam === '30' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>30 ngày</Link>
            <Link href="?filter=this_month" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'this_month' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Tháng này</Link>
            <Link href="?filter=last_month" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'last_month' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Tháng trước</Link>
            <Link href="?filter=this_year" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'this_year' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Năm nay</Link>
            <Link href="?filter=last_year" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'last_year' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Năm trước</Link>
            <Link href="?filter=all" className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${filterParam === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Tất cả</Link>
          </div>
          <div className="text-sm font-medium text-gray-500 bg-white px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm hidden 2xl:block whitespace-nowrap">
            Cập nhật lúc: {new Date().toLocaleTimeString('vi-VN')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${stat.color}`}>
                {stat.icon}
              </div>
              {stat.trend !== undefined && <TrendBadge value={stat.trend} />}
            </div>
            <div>
              <h3 className="text-gray-500 text-xs font-medium mb-1 line-clamp-1">{stat.title}</h3>
              <p className="text-lg md:text-xl font-bold text-gray-900 truncate" title={stat.value}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="font-bold text-gray-900 mb-6">Doanh thu 7 ngày gần nhất</h3>
          <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 pb-6 mt-auto">
            {chartData.map((d, i) => {
              const heightPercent = (d.amount / maxAmount) * 100;
              return (
                <div key={i} className="flex flex-col items-center flex-1 group">
                  <div className="text-xs text-gray-500 mb-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    {(d.amount / 1000).toLocaleString()}k
                  </div>
                  <div className="w-full bg-blue-50 rounded-t-lg relative flex items-end h-[200px]">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-500 ease-out"
                      style={{ height: `${heightPercent}%`, minHeight: d.amount > 0 ? '4px' : '0' }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400 mt-3 font-medium">{d.date}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-hidden flex flex-col h-96">
          <h3 className="font-bold text-gray-900 mb-4">Top 5 Bán chạy nhất (Theo bộ lọc)</h3>
          {bestSellers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu bán hàng</div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {bestSellers.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-sm shrink-0">
                      #{i + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 text-sm line-clamp-1" title={item.name}>{item.name}</div>
                      <div className="text-xs text-gray-500">{item.revenue.toLocaleString("vi-VN")} đ</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded whitespace-nowrap">
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
