import { findAll } from "@/lib/sheets_db";
import { BrandForm, DeleteBrandButton } from "./components/BrandForm";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const allBrands = await findAll("Brands");
  const brands = allBrands.filter((b: DBBrand) => b.status !== "DELETED");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Quản lý Thương hiệu</h1>
          <p className="text-gray-500 mt-1">Quản lý các thương hiệu F&B đang hoạt động trên hệ thống.</p>
        </div>
        <BrandForm />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                    <BrandForm initialData={brand} />
                    <DeleteBrandButton id={brand.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
