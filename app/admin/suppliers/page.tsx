import { findAll } from "@/lib/sheets_db";
import { SupplierForm, DeleteSupplierButton } from "@/components/SupplierForm";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await findAll("Suppliers");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Nhà Cung Cấp</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Quản lý đối tác và nhà cung cấp nguyên vật liệu.</p>
        </div>
        <SupplierForm />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
              <th className="px-6 py-4 font-medium w-24">ID</th>
              <th className="px-6 py-4 font-medium">Tên Nhà Cung Cấp</th>
              <th className="px-6 py-4 font-medium">Liên hệ</th>
              <th className="px-6 py-4 font-medium">Mã Số Thuế</th>
              <th className="px-6 py-4 font-medium">Ghi chú</th>
              <th className="px-6 py-4 font-medium text-right w-32">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <div className="text-4xl mb-3">🚚</div>
                  <p>Chưa có dữ liệu nhà cung cấp.</p>
                </td>
              </tr>
            ) : (
              suppliers.map((supplier: any) => (
                <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{supplier.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-800 font-semibold">{supplier.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {supplier.phone && <div>📞 {supplier.phone}</div>}
                    {supplier.address && <div className="text-xs text-gray-400 mt-1 truncate max-w-[200px]" title={supplier.address}>📍 {supplier.address}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{supplier.tax_id || "-"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {supplier.links ? (
                      <span className="truncate block max-w-[150px]" title={supplier.links}>{supplier.links}</span>
                    ) : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-3 flex justify-end items-center">
                    <SupplierForm initialData={supplier} />
                    <DeleteSupplierButton id={supplier.id} />
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
