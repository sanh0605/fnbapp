import { findAll } from "@/lib/sheets_db";
import { UnitForm, DeleteBtn } from "./UnitForm";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const allUnits = await findAll("Units");
  
  // Filter out softly deleted or we hard delete
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Đơn vị (Units)</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý danh sách các đơn vị tính hợp lệ (kg, lít, hộp...)</p>
        </div>
        <UnitForm />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Tên đơn vị</th>
                <th className="p-4 font-medium">Ghi chú</th>
                <th className="p-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {units.length === 0 ? (
                <tr>
                <td colSpan={3} className="p-0">
                  <EmptyState 
                    icon="📏" 
                    title="Chưa có đơn vị nào" 
                    description="Thêm đơn vị tính để sử dụng trong hệ thống."
                  />
                </td>
              </tr>
              ) : (
                units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 font-medium text-gray-900">{unit.name}</td>
                    <td className="p-4 text-gray-600">{unit.description}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <UnitForm initialData={unit} />
                        <DeleteBtn id={unit.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
