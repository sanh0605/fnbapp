import { findAll } from "@/lib/sheets_db";

export default async function AdminDashboard() {
  const [brands, users, suppliers, orders, orderLines, products, variants] = await Promise.all([
    findAll("Brands"),
    findAll("Users"),
    findAll("Suppliers"),
    findAll("Orders"),
    findAll("Order_Lines"),
    findAll("Products"),
    findAll("Product_Variants")
  ]);

  const completedOrders = orders.filter((o:any) => o.status === "COMPLETED");
  const totalRevenue = completedOrders.reduce((sum:number, order:any) => sum + (parseFloat(order.total_amount) || 0), 0);
  
  const stats = [
    { title: "Tổng Doanh Thu", value: `${totalRevenue.toLocaleString("vi-VN")} đ`, icon: "💰", color: "bg-green-100 text-green-700" },
    { title: "Đơn hàng hoàn tất", value: completedOrders.length.toString(), icon: "🧾", color: "bg-blue-100 text-blue-700" },
    { title: "Nhà cung cấp", value: suppliers.length.toString(), icon: "🏢", color: "bg-purple-100 text-purple-700" },
    { title: "Nhân sự", value: users.length.toString(), icon: "👥", color: "bg-orange-100 text-orange-700" },
  ];

  // Tính Best Sellers
  const productSales: Record<string, { qty: number, revenue: number, name: string }> = {};
  
  orderLines.forEach((line:any) => {
    // Only count if order is completed
    const order = completedOrders.find((o:any) => o.id === line.order_id);
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

  // Nhóm doanh thu theo ngày (7 ngày gần nhất)
  const today = new Date();
  const salesByDate: Record<string, number> = {};
  for(let i=6; i>=0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    salesByDate[d.toLocaleDateString("en-GB")] = 0; // DD/MM/YYYY format
  }

  completedOrders.forEach((o:any) => {
    if(!o.created_at) return;
    const dateStr = new Date(o.created_at).toLocaleDateString("en-GB");
    if(salesByDate[dateStr] !== undefined) {
      salesByDate[dateStr] += Number(o.total_amount || 0);
    }
  });

  const chartData = Object.entries(salesByDate).map(([date, amount]) => ({
    date: date.substring(0, 5), // Lấy DD/MM
    amount
  }));
  const maxAmount = Math.max(...chartData.map(d => d.amount), 1); // Avoid div by 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tổng quan Hệ thống</h1>
          <p className="text-gray-500 mt-1">Xin chào, đây là tình hình kinh doanh hiện tại của bạn.</p>
        </div>
        <div className="text-sm font-medium text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
          Cập nhật lúc: {new Date().toLocaleTimeString('vi-VN')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            <h3 className="text-gray-500 text-sm font-medium">{stat.title}</h3>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
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
          <h3 className="font-bold text-gray-900 mb-4">Top 5 Bán chạy nhất</h3>
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
                      <div className="font-medium text-gray-800 text-sm line-clamp-1">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.revenue.toLocaleString("vi-VN")} đ</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded">
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
