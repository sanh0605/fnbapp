import { findAll } from "@/lib/sheets_db";
import Link from "next/link";

export default async function PurchaseOrdersPage() {
  const [purchaseOrders, suppliers] = await Promise.all([
    findAll("Purchase_Orders"),
    findAll("Suppliers"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Phiếu Nhập Kho</h1>
          <p className="text-gray-500 mt-1">Quản lý lịch sử nhập hàng và phiếu nháp.</p>
        </div>
        <Link 
          href="/admin/inventory/purchase-orders/new" 
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          + Tạo Phiếu Nhập
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Mã Phiếu</th>
                <th className="px-6 py-4">Ngày Tạo</th>
                <th className="px-6 py-4">Nhà Cung Cấp</th>
                <th className="px-6 py-4 text-right">Tổng Tiền</th>
                <th className="px-6 py-4 text-center">Trạng Thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Chưa có phiếu nhập kho nào.
                  </td>
                </tr>
              ) : (
                purchaseOrders.reverse().map((po: any) => {
                  const supplier = suppliers.find((s: any) => s.id === po.supplier_id);
                  const isDraft = po.status === "DRAFT";
                  
                  return (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{po.id}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(po.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-gray-800">{supplier ? supplier.name : po.supplier_id}</td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-600">
                        {Number(po.total_amount).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          isDraft ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {isDraft ? "Lưu Nháp" : "Đã Hoàn Thành"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isDraft ? (
                          <Link href={`/admin/inventory/purchase-orders/${po.id}`} className="text-blue-600 hover:text-blue-800 font-medium">Tiếp tục</Link>
                        ) : (
                          <Link href={`/admin/inventory/purchase-orders/${po.id}`} className="text-gray-600 hover:text-gray-900 font-medium">Xem</Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
