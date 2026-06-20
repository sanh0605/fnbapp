import { findAll } from "@/lib/sheets_db";
import { BaseIngredientForm, DeleteBtn } from "@/components/InventoryForms";
import { deleteBaseIngredient } from "@/app/actions/inventory";

export const dynamic = "force-dynamic";

export default async function BaseIngredientsPage() {
  const [ingredients, allUnits] = await Promise.all([
    findAll("Base_Ingredients"),
    findAll("Units")
  ]);
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Nhóm Nguyên Liệu Gốc</h1>
          <p className="text-gray-500 mt-1">Danh sách nguyên liệu gốc để xây dựng công thức pha chế.</p>
        </div>
        <BaseIngredientForm units={units} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Tên Nguyên Liệu</th>
              <th className="px-6 py-4 font-medium">Đơn Vị Gốc (Base Unit)</th>
              <th className="px-6 py-4 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ingredients.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-500">Chưa có dữ liệu</td></tr>
            )}
            {ingredients.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{c.id}</td>
                <td className="px-6 py-4 font-semibold text-gray-800">{c.name}</td>
                <td className="px-6 py-4 font-medium text-emerald-600">{units.find((u:any) => u.id === c.base_unit)?.name || c.base_unit}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <BaseIngredientForm initialData={c} units={units} />
                    <DeleteBtn id={c.id} actionFn={deleteBaseIngredient} />
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
