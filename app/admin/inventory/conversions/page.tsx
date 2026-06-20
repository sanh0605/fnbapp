import { findAll } from "@/lib/sheets_db";
import { ConversionForm, DeleteBtn } from "@/components/InventoryForms";
import { deleteConversion } from "@/app/actions/inventory";

export const dynamic = "force-dynamic";

export default async function ConversionsPage() {
  const [baseIngredients, items, conversions, allUnits] = await Promise.all([
    findAll("Base_Ingredients"),
    findAll("Purchased_Items"),
    findAll("UOM_Conversions"),
    findAll("Units"),
  ]);

  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bảng Quy Đổi Đơn Vị</h1>
          <p className="text-gray-500 mt-1">Thiết lập tỉ lệ quy đổi từ Hàng mua vào sang Nguyên liệu gốc.</p>
        </div>
        <ConversionForm items={items} baseIngredients={baseIngredients} units={units} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Hàng Hoá Mua Vào</th>
              <th className="px-6 py-4 font-medium text-center bg-blue-50">Đơn vị Mua (Nhập)</th>
              <th className="px-6 py-4 font-medium text-center">=</th>
              <th className="px-6 py-4 font-medium text-center bg-green-50">Hệ số quy đổi</th>
              <th className="px-6 py-4 font-medium text-center bg-gray-50">Đơn vị Gốc (Kho)</th>
              <th className="px-6 py-4 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {conversions.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-500">Chưa thiết lập quy đổi.</td></tr>
            )}
            {conversions.map((conv: any) => {
              const item = items.find((i: any) => i.id === conv.purchased_item_id);
              return (
                <tr key={conv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{conv.id}</td>
                  <td className="px-6 py-4 font-semibold text-gray-800">{item ? item.name : conv.purchased_item_id}</td>
                  <td className="px-6 py-4 text-center text-blue-700 font-medium">1 {units.find((u:any) => u.id === conv.purchased_unit)?.name || conv.purchased_unit}</td>
                  <td className="px-6 py-4 text-center text-gray-400">=</td>
                  <td className="px-6 py-4 text-center text-green-700 font-bold">{conv.conversion_rate}</td>
                  <td className="px-6 py-4 text-center font-medium text-emerald-600">{units.find((u:any) => u.id === conv.base_unit)?.name || conv.base_unit}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <ConversionForm items={items} baseIngredients={baseIngredients} initialData={conv} units={units} />
                      <DeleteBtn id={conv.id} actionFn={deleteConversion} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
