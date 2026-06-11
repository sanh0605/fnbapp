import { findAll } from "@/lib/sheets_db";
import ProductCategoryForm from "@/components/ProductCategoryForm";

export default async function ProductCategoriesPage() {
  const [categories, products] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
  ]);
  const activeCategories = categories.filter(c => c.status !== "DELETED");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Danh mục Nhóm Món</h1>
          <p className="text-gray-500 mt-1">Phân loại Menu (Ví dụ: Cà Phê, Trà Sữa, Bánh Ngọt) để hiển thị trên POS.</p>
        </div>
        <ProductCategoryForm />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {activeCategories.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có Nhóm Món nào</h3>
            <p className="text-gray-500 mb-4">Tạo nhóm đầu tiên để phân loại menu của quán.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-16 text-center">STT</th>
                <th className="px-6 py-4">Tên Danh Mục</th>
                <th className="px-6 py-4">Số lượng Món</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeCategories.map((cat, index) => {
                const productCount = products.filter(p => p.category_id === cat.id && p.status !== "DELETED").length;
                return (
                  <tr key={cat.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 text-center font-medium text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 font-bold text-gray-800 text-base">{cat.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {productCount} món
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ProductCategoryForm initialData={cat} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
