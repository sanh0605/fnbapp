import { findAll } from "@/lib/sheets_db";
import { PurchasedItemForm, DeleteBtn } from "@/components/InventoryForms";
import { deletePurchasedItem } from "@/app/actions/inventory";

export default async function ItemsPage() {
  const [categories, baseIngredients, items, conversions, allUnits] = await Promise.all([
    findAll("Item_Categories"),
    findAll("Base_Ingredients"),
    findAll("Purchased_Items"),
    findAll("UOM_Conversions"),
    findAll("Units")
  ]);

  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Hàng Cụ Thể Mua Vào</h1>
          <p className="text-gray-500 mt-1">Quản lý các mặt hàng thực tế nhập từ nhà cung cấp.</p>
        </div>
        <PurchasedItemForm itemCategories={categories} baseIngredients={baseIngredients} units={units} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Tên Hàng Mua</th>
              <th className="px-6 py-4 font-medium">Thuộc Phân Loại</th>
              <th className="px-6 py-4 font-medium">Thuộc Nguyên Liệu</th>
              <th className="px-6 py-4 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">Chưa có dữ liệu</td></tr>
            )}
            {items.map((i: any) => {
              const cat = categories.find((c: any) => c.id === i.item_category_id);
              const ing = baseIngredients.find((b: any) => b.id === i.base_ingredient_id);
              return (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{i.id}</td>
                  <td className="px-6 py-4 font-semibold text-gray-800">{i.name}</td>
                  <td className="px-6 py-4 text-gray-600">{cat ? `${cat.name} (${cat.system_type})` : i.item_category_id}</td>
                  <td className="px-6 py-4 text-blue-600">{ing ? `${ing.name}` : '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <PurchasedItemForm 
                        itemCategories={categories} 
                        baseIngredients={baseIngredients} 
                        initialData={i} 
                        initialConversions={conversions.filter((c: any) => c.purchased_item_id === i.id)}
                        units={units}
                      />
                      <DeleteBtn id={i.id} actionFn={deletePurchasedItem} />
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
