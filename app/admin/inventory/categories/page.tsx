import { findAll } from "@/lib/sheets_db";
import { ItemCategoryForm, DeleteBtn } from "@/components/InventoryForms";
import { deleteItemCategory } from "@/app/actions/inventory";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await findAll("Item_Categories");

  const getTypeLabel = (type: string) => {
    switch(type) {
      case "RAW": return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">Nguyên Liệu (RAW)</span>;
      case "CONSUMABLE": return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium">Vật Tư (CONSUMABLE)</span>;
      case "EQUIPMENT": return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">Dụng Cụ (EQUIPMENT)</span>;
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Phân Loại Hàng Hoá</h1>
          <p className="text-gray-500 mt-1">Tự do tạo các phân loại tuỳ chỉnh (Bao bì, Nguyên liệu ướt, v.v.).</p>
        </div>
        <ItemCategoryForm />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Tên Phân Loại</th>
              <th className="px-6 py-4 font-medium">Đặc Tính (System Type)</th>
              <th className="px-6 py-4 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-500">Chưa có dữ liệu</td></tr>
            )}
            {categories.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{c.id}</td>
                <td className="px-6 py-4 font-semibold text-gray-800">{c.name}</td>
                <td className="px-6 py-4">{getTypeLabel(c.system_type)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <ItemCategoryForm initialData={c} />
                    <DeleteBtn id={c.id} actionFn={deleteItemCategory} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
