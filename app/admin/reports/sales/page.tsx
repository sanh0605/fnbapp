import { findAll } from "@/lib/sheets_db";
import SalesFilter from "@/components/SalesFilter";
import SalesCharts from "@/components/SalesCharts";
import CategoryPieChart from "@/components/CategoryPieChart";

export const dynamic = 'force-dynamic';

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [orders, orderLines, products, variants, brands, users, categories] = await Promise.all([
    findAll("Orders"),
    findAll("Order_Lines"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Brands"),
    findAll("Users"),
    findAll("Product_Categories")
  ]);

  // Xác định khoảng thời gian
  let startDate = new Date();
  startDate.setDate(1); // Mặc định từ đầu tháng
  startDate.setHours(0,0,0,0);
  let endDate = new Date();
  endDate.setHours(23,59,59,999);

  const startParam = Array.isArray(searchParams?.start) ? searchParams.start[0] : searchParams?.start;
  const endParam = Array.isArray(searchParams?.end) ? searchParams.end[0] : searchParams?.end;
  const brandId = Array.isArray(searchParams?.brandId) ? searchParams.brandId[0] : searchParams?.brandId;
  const staffName = Array.isArray(searchParams?.staffName) ? searchParams.staffName[0] : searchParams?.staffName;
  const categoryId = Array.isArray(searchParams?.categoryId) ? searchParams.categoryId[0] : searchParams?.categoryId;

  if (startParam) startDate = new Date(startParam);
  if (endParam) endDate = new Date(endParam);

  const completedOrders = orders.filter((o:any) => {
    if (o.status !== "COMPLETED") return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    if (d < startDate || d > endDate) return false;
    if (brandId && o.brand_id !== brandId) return false;
    if (staffName && o.staff_name !== staffName) return false;
    return true;
  });

  // Mảng chứa các line hợp lệ
  const validLines: any[] = [];
  const productSalesMap: Record<string, { 
    name: string; 
    totalQty: number; 
    totalRevenue: number; 
    sizes: Record<string, number>
  }> = {};
  const toppingSalesMap: Record<string, { name: string, qty: number, revenue: number }> = {};
  const allSizesSet = new Set<string>();
  const categorySalesMap: Record<string, number> = {};
  let totalCups = 0;
  
  orderLines.forEach((line:any) => {
    const order = completedOrders.find((o:any) => o.id === line.order_id);
    if (!order) return;

    const p = products.find((x:any) => x.id === line.product_id);
    if (categoryId && p?.category_id !== categoryId) return;

    line.created_at = order.created_at; // Gắn timestamp để vẽ chart
    validLines.push(line);

    const qty = Number(line.qty || 0);
    const price = Number(line.unit_price || 0);
    const lineTotal = (qty * price) - Number(line.line_discount || 0);
    
    const pName = p ? p.name : line.product_id;
    const v = variants.find((x:any) => x.id === line.variant_id);
    const sizeName = v ? (v.size_name || 'Mặc định') : 'Mặc định';

    if (!productSalesMap[line.product_id]) {
      productSalesMap[line.product_id] = { name: pName, totalQty: 0, totalRevenue: 0, sizes: {} };
    }
    
    productSalesMap[line.product_id].totalQty += qty;
    productSalesMap[line.product_id].totalRevenue += lineTotal;
    
    if (!productSalesMap[line.product_id].sizes[sizeName]) {
      productSalesMap[line.product_id].sizes[sizeName] = 0;
    }
    productSalesMap[line.product_id].sizes[sizeName] += qty;
    allSizesSet.add(sizeName);
    totalCups += qty;

    if (line.modifiers_json) {
      try {
        const modifiers = JSON.parse(line.modifiers_json);
        if (Array.isArray(modifiers)) {
          modifiers.forEach((mod: any) => {
            const modKey = mod.id || mod.name;
            if (!modKey) return;
            if (!toppingSalesMap[modKey]) {
              toppingSalesMap[modKey] = { name: mod.name, qty: 0, revenue: 0 };
            }
            toppingSalesMap[modKey].qty += qty;
            toppingSalesMap[modKey].revenue += Number(mod.price || 0) * qty;
          });
        }
      } catch (e) {}
    }

    const catId = p?.category_id || "unknown";
    if (!categorySalesMap[catId]) categorySalesMap[catId] = 0;
    categorySalesMap[catId] += lineTotal;
  });

  const uniqueSizes = Array.from(allSizesSet).sort((a,b) => a.localeCompare(b));
  const bestSellers = Object.values(productSalesMap).sort((a, b) => b.totalQty - a.totalQty);
  const bestToppings = Object.values(toppingSalesMap).sort((a, b) => b.qty - a.qty);

  // Tính tổng cộng cho từng cột sản lượng
  const totalQtyBySize = uniqueSizes.reduce((acc, size) => {
    acc[size] = bestSellers.reduce((sum, item) => sum + (item.sizes[size] || 0), 0);
    return acc;
  }, {} as Record<string, number>);
  const totalQtyAll = bestSellers.reduce((sum, item) => sum + item.totalQty, 0);
  const totalRevenueAll = bestSellers.reduce((sum, item) => sum + item.totalRevenue, 0);

  // Tính tổng cộng cho topping
  const totalToppingQty = bestToppings.reduce((sum, item) => sum + item.qty, 0);
  const totalToppingRevenue = bestToppings.reduce((sum, item) => sum + item.revenue, 0);

  // Tính KPIs dựa trên validLines (nếu có lọc category) hoặc order (nếu không lọc)
  let totalRevenue = 0;
  let totalOrders = 0;
  
  if (categoryId) {
    totalRevenue = validLines.reduce((sum, line) => sum + ((Number(line.qty || 0) * Number(line.unit_price || 0)) - Number(line.line_discount || 0)), 0);
    const uniqueOrderIds = new Set(validLines.map(l => l.order_id));
    totalOrders = uniqueOrderIds.size;
  } else {
    totalRevenue = completedOrders.reduce((sum:number, order:any) => sum + (parseFloat(order.total_amount) || 0), 0);
    totalOrders = completedOrders.length;
  }
  
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Group by Date, DOW, Hour for Chart
  const salesByDate: Record<string, number> = {};
  const salesByDayOfWeek: Record<number, number> = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 0:0 };
  const salesByHour: Record<number, number> = {};
  const salesByMonth: Record<string, number> = {};
  for(let i=0; i<24; i++) salesByHour[i] = 0;
  
  let curr = new Date(startDate);
  while(curr <= endDate) {
    salesByDate[curr.toLocaleDateString("en-GB")] = 0;
    curr.setDate(curr.getDate() + 1);
  }

  let currMonth = new Date(startDate);
  currMonth.setDate(1);
  while(currMonth <= endDate) {
    salesByMonth[`${currMonth.getMonth()+1}/${currMonth.getFullYear()}`] = 0;
    currMonth.setMonth(currMonth.getMonth() + 1);
  }

  if (categoryId) {
    validLines.forEach((line:any) => {
      if(!line.created_at) return;
      const d = new Date(line.created_at);
      const dateStr = d.toLocaleDateString("en-GB");
      const monthKey = `${d.getMonth()+1}/${d.getFullYear()}`;
      const amount = (Number(line.qty || 0) * Number(line.unit_price || 0)) - Number(line.line_discount || 0);

      if(salesByDate[dateStr] !== undefined) salesByDate[dateStr] += amount;
      if(salesByMonth[monthKey] !== undefined) salesByMonth[monthKey] += amount;
      salesByDayOfWeek[d.getDay()] += amount;
      salesByHour[d.getHours()] += amount;
    });
  } else {
    completedOrders.forEach((o:any) => {
      if(!o.created_at) return;
      const d = new Date(o.created_at);
      const dateStr = d.toLocaleDateString("en-GB");
      const monthKey = `${d.getMonth()+1}/${d.getFullYear()}`;
      const amount = Number(o.total_amount || 0);

      if(salesByDate[dateStr] !== undefined) salesByDate[dateStr] += amount;
      if(salesByMonth[monthKey] !== undefined) salesByMonth[monthKey] += amount;
      salesByDayOfWeek[d.getDay()] += amount;
      salesByHour[d.getHours()] += amount;
    });
  }

  const chartDataDate = Object.entries(salesByDate).map(([date, amount]) => ({
    label: date.substring(0, 5),
    amount
  }));

  const chartDataMonth = Object.entries(salesByMonth).map(([month, amount]) => ({
    label: month,
    amount
  }));

  const dowNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const chartDataDOW = [1, 2, 3, 4, 5, 6, 0].map(dow => ({
    label: dowNames[dow],
    amount: salesByDayOfWeek[dow]
  }));

  const chartDataHour = Object.entries(salesByHour).map(([hour, amount]) => ({
    label: `${hour}h`,
    amount
  }));

  const chartDataCategory = Object.entries(categorySalesMap).map(([catId, amount]) => {
    const c = categories.find((x:any) => x.id === catId);
    return {
      label: c ? c.name : "Khác",
      amount
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Báo cáo Bán hàng</h1>
        <p className="text-gray-500 mt-1">Phân tích hiệu quả kinh doanh theo thời gian.</p>
      </div>

      <SalesFilter brands={brands} users={users} categories={categories} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Tổng Doanh Thu</div>
          <div className="text-3xl font-bold text-gray-900">{totalRevenue.toLocaleString("vi-VN")} đ</div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Tổng Số Đơn</div>
          <div className="text-3xl font-bold text-gray-900">{totalOrders} <span className="text-sm font-normal text-gray-500">đơn</span></div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Doanh Thu Trung Bình / Đơn</div>
          <div className="text-3xl font-bold text-gray-900">{Math.round(avgOrderValue).toLocaleString("vi-VN")} đ</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
        <SalesCharts 
          salesByDate={chartDataDate}
          salesByDayOfWeek={chartDataDOW}
          salesByHour={chartDataHour}
          salesByMonth={chartDataMonth}
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
              Tổng: {totalCups} ly
            </span>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
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
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{item.totalRevenue.toLocaleString("vi-VN")} đ</td>
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
                    <td className="px-4 py-3 text-right text-green-700">{totalRevenueAll.toLocaleString("vi-VN")} đ</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Toppings Table */}
        <div className="xl:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Top Topping Bán Chạy</h3>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
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
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{item.revenue.toLocaleString("vi-VN")} đ</td>
                    </tr>
                  ))
                )}
              </tbody>
              {bestToppings.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 sticky bottom-0 z-10 font-bold text-gray-900 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                  <tr>
                    <td className="px-4 py-3">Tổng cộng</td>
                    <td className="px-4 py-3 text-right">{totalToppingQty.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3 text-right text-green-700">{totalToppingRevenue.toLocaleString("vi-VN")} đ</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
