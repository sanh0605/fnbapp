import { findAll } from "@/lib/sheets_db";
import { ItemCategoryForm, DeleteBtn } from "@/components/InventoryForms";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { deleteItemCategory } from "@/app/admin/inventory/actions";

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
      <PageHeader 
        title="Phân Loại Hàng Hoá" 
        subtitle="Tự do tạo các phân loại tuỳ chỉnh (Bao bì, Nguyên liệu ướt, v.v.)."
        actions={<ItemCategoryForm />}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
              <th scope="col" className="px-6 py-4 font-bold">ID</th>
              <th scope="col" className="px-6 py-4 font-bold">Tên Phân Loại</th>
              <th scope="col" className="px-6 py-4 font-bold">Đặc Tính (System Type)</th>
              <th scope="col" className="px-6 py-4 font-bold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="p-0">
                  <EmptyState 
                    icon="📂" 
                    title="Chưa có danh mục" 
                    description="Thêm danh mục để phân loại hàng hóa."
                  />
                </td>
              </tr>
            )}
            {categories.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
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
