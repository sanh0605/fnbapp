import { findAll } from "@/lib/sheets_db";
import ProductionForm from "@/components/ProductionForm";

export default async function ProductionPage() {
  const [productionOrders, productionItems, semiProducts, recipes, baseIngredients, allUnits] = await Promise.all([
    findAll("Production_Orders"),
    findAll("Production_Items"),
    findAll("Semi_Products"),
    findAll("Recipes"),
    findAll("Base_Ingredients"),
    findAll("Units")
  ]);

  const activeSemiProducts = semiProducts.filter(sp => sp.status !== "DELETED");
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  // Sắp xếp lệnh nấu mới nhất lên đầu
  const sortedOrders = [...productionOrders].sort((a: any, b: any) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sản xuất / Nấu Bếp</h1>
          <p className="text-gray-500 mt-1">Ghi nhận các lệnh nấu mẻ để tự động trừ kho nguyên liệu.</p>
        </div>
        <ProductionForm 
          semiProducts={activeSemiProducts}
          recipes={recipes}
          baseIngredients={baseIngredients}
          units={units}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Lịch sử Lệnh nấu</h2>
        </div>
        
        {sortedOrders.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có lệnh nấu nào</h3>
            <p className="text-gray-500">Bấm "Nấu Mẻ Mới" để bắt đầu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Mã Lệnh</th>
                  <th className="px-6 py-4">Ngày thực hiện</th>
                  <th className="px-6 py-4">Bán Thành Phẩm Thu Được</th>
                  <th className="px-6 py-4">Sản lượng (Yield)</th>
                  <th className="px-6 py-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedOrders.map((order) => {
                  const items = productionItems.filter(i => i.production_order_id === order.id);
                  const dateObj = new Date(order.apply_date);
                  
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900">{order.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{dateObj.toLocaleDateString('vi-VN')}</div>
                        <div className="text-xs text-gray-500">{dateObj.toLocaleTimeString('vi-VN')}</div>
                      </td>
                      <td className="px-6 py-4">
                        {items.map((item, idx) => {
                          const sp = semiProducts.find(s => s.id === item.semi_product_id);
                          return (
                            <div key={idx} className="font-bold text-indigo-700">
                              {sp?.name || item.semi_product_id}
                            </div>
                          );
                        })}
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-600">
                        {items.map((item, idx) => {
                          const sp = semiProducts.find(s => s.id === item.semi_product_id);
                          const unitName = units.find((u:any) => u.id === sp?.base_unit)?.name || sp?.base_unit || "";
                          return (
                            <div key={idx}>+ {item.qty_produced} {unitName}</div>
                          );
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Đã trừ kho
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
