import { findAll } from "@/lib/sheets_db";
import { UnitForm, DeleteBtn } from "./UnitForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const allUnits = await findAll("Units");
  
  // Filter out softly deleted or we hard delete
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Đơn vị (Units)" 
        subtitle="Quản lý danh sách các đơn vị tính hợp lệ (kg, lít, hộp...)"
        actions={<UnitForm />}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-600">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold">Tên đơn vị</th>
                <th scope="col" className="px-6 py-4 font-bold">Ghi chú</th>
                <th scope="col" className="px-6 py-4 font-bold text-right">Thao tác</th>
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
                  <tr key={unit.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 font-semibold">{unit.name}</td>
                    <td className="px-6 py-4 text-gray-500">{unit.description || "—"}</td>
                    <td className="px-6 py-4 text-right">
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

        {/* Mobile Card Layout (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-gray-50/30">
          {units.length === 0 ? (
            <EmptyState 
              icon="📏" 
              title="Chưa có đơn vị nào" 
              description="Thêm đơn vị tính để sử dụng trong hệ thống."
            />
          ) : (
            units.map((unit) => (
              <div key={unit.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="font-bold text-gray-900">{unit.name}</div>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Ghi chú:</span> {unit.description || "—"}
                </div>
                <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-gray-100/50">
                  <div className="flex items-center min-h-[44px]">
                    <UnitForm initialData={unit} />
                  </div>
                  <div className="flex items-center min-h-[44px]">
                    <DeleteBtn id={unit.id} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
