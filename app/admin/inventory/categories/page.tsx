import { findAll } from "@/lib/db/tables";
import { ItemCategoryForm, DeleteBtn } from "@/app/admin/inventory/components/InventoryForms";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { deleteItemCategory } from "@/app/admin/inventory/actions";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categories, auth] = await Promise.all([findAll("Item_Categories"), resolveActor()]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deleteItemCategory is what
  // actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  const getTypeLabel = (type: string) => {
    switch(type) {
      case "RAW": return <span className="px-3 py-1 bg-primary/20 text-primary-active rounded-lg text-xs font-medium">Nguyên Liệu (RAW)</span>;
      case "CONSUMABLE": return <span className="px-3 py-1 bg-warning/20 text-warning-active rounded-lg text-xs font-medium">Vật Tư (CONSUMABLE)</span>;
      case "EQUIPMENT": return <span className="px-3 py-1 bg-surface-secondary text-text-secondary rounded-lg text-xs font-medium">Dụng Cụ (EQUIPMENT)</span>;
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

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th scope="col" className="px-6 py-4 font-bold">ID</th>
                <th scope="col" className="px-6 py-4 font-bold">Tên Phân Loại</th>
                <th scope="col" className="px-6 py-4 font-bold">Đặc Tính (System Type)</th>
                <th scope="col" className="px-6 py-4 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                <tr key={c.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-text-primary">{c.id}</td>
                  <td className="px-6 py-4 font-semibold text-text-primary">{c.name}</td>
                  <td className="px-6 py-4">{getTypeLabel(c.system_type)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <ItemCategoryForm initialData={c} />
                      {canDelete && <DeleteBtn id={c.id} actionFn={deleteItemCategory} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-surface-secondary/30">
          {categories.length === 0 ? (
            <EmptyState 
              icon="📂" 
              title="Chưa có danh mục" 
              description="Thêm danh mục để phân loại hàng hóa."
            />
          ) : (
            categories.map((c: any) => (
              <div key={c.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-text-primary">{c.name}</div>
                    <div className="text-[11px] font-mono text-text-muted mt-0.5">{c.id}</div>
                  </div>
                </div>
                <div>
                  {getTypeLabel(c.system_type)}
                </div>
                <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-border">
                  <div className="flex items-center min-h-[44px]">
                    <ItemCategoryForm initialData={c} />
                  </div>
                  <div className="flex items-center min-h-[44px]">
                    {canDelete && <DeleteBtn id={c.id} actionFn={deleteItemCategory} />}
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
