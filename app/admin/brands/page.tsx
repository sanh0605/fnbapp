import { findAll } from "@/lib/sheets_db";
import { BrandForm, DeleteBrandButton } from "./components/BrandForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const allBrands = await findAll("Brands");
  const brands = allBrands.filter((b: DBBrand) => b.status !== "DELETED");

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Quản lý Thương hiệu" 
        subtitle="Quản lý các thương hiệu F&B đang hoạt động trên hệ thống."
        actions={<BrandForm />}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th scope="col" className="px-6 py-4 font-bold">ID</th>
                <th scope="col" className="px-6 py-4 font-bold">Tên Thương Hiệu</th>
                <th scope="col" className="px-6 py-4 font-bold text-center">Mã Đơn Hàng</th>
                <th scope="col" className="px-6 py-4 font-bold">Ngày Bắt Đầu</th>
                <th scope="col" className="px-6 py-4 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {brands.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState 
                      icon="🏢" 
                      title="Chưa có thương hiệu" 
                      description="Thêm thương hiệu đầu tiên để bắt đầu."
                    />
                  </td>
                </tr>
              ) : (
                brands.map((brand: DBBrand) => (
                  <tr key={brand.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{brand.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-800 font-semibold">{brand.name}</td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-600 text-center">{brand.code || "N/A"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {brand.start_date ? new Date(brand.start_date).toLocaleDateString('en-GB') : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex justify-end items-center">
                        <BrandForm initialData={brand} />
                        <DeleteBrandButton id={brand.id} />
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
          {brands.length === 0 ? (
            <EmptyState 
              icon="🏢" 
              title="Chưa có thương hiệu" 
              description="Thêm thương hiệu đầu tiên để bắt đầu."
            />
          ) : (
            brands.map((brand: DBBrand) => (
              <div key={brand.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-900">{brand.name}</div>
                    <div className="text-[11px] font-mono text-gray-400 mt-0.5">{brand.id}</div>
                  </div>
                  {brand.code && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                      Mã ĐH: {brand.code}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="text-gray-400">Ngày Bắt Đầu:</span> <span className="font-medium">{brand.start_date ? new Date(brand.start_date).toLocaleDateString('en-GB') : "N/A"}</span>
                </div>
                <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-gray-100/50">
                  <div className="flex items-center min-h-[44px]">
                    <BrandForm initialData={brand} />
                  </div>
                  <div className="flex items-center min-h-[44px]">
                    <DeleteBrandButton id={brand.id} />
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
