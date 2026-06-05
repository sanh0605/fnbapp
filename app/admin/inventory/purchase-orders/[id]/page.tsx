import { findById, findAll } from "@/lib/sheets_db";
import Link from "next/link";
import { notFound } from "next/navigation";
import PurchaseOrderForm from "@/components/PurchaseOrderForm";

export default async function PurchaseOrderDetail({ params }: { params: { id: string } }) {
  const [po, lines, allItems, allBaseIngredients, allUnits, allSuppliers, allConversions, allSources] = await Promise.all([
    findById("Purchase_Orders", params.id),
    findAll("Purchase_Order_Lines"),
    findAll("Purchased_Items"),
    findAll("Base_Ingredients"),
    findAll("Units"),
    findAll("Suppliers"),
    findAll("UOM_Conversions"),
    findAll("Purchase_Sources")
  ]);

  if (!po) {
    notFound();
  }

  const poLines = lines.filter((l: any) => l.po_id === params.id);
  const isDraft = po.status === "DRAFT";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory/purchase-orders" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition">
          Quay lại
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isDraft ? "Tiếp tục tạo Phiếu Nhập Kho" : "Chi tiết Phiếu Nhập Kho"}: {po.id}</h1>
          <p className="text-gray-500">Ngày tạo: {new Date(po.created_at).toLocaleString('vi-VN')} | Ngày giao dịch: {po.transaction_date ? new Date(po.transaction_date).toLocaleString('vi-VN') : 'N/A'}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`px-3 py-1 text-sm font-bold rounded-full ${po.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {po.status === 'COMPLETED' ? 'Đã Hoàn Thành' : 'Nháp'}
          </span>
        </div>
      </div>

      {isDraft ? (
        <PurchaseOrderForm 
          suppliers={allSuppliers}
          sources={allSources}
          items={allItems}
          conversions={allConversions}
          baseIngredients={allBaseIngredients}
          units={allUnits}
          initialData={{ po, lines: poLines }}
        />
      ) : (

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-bold text-gray-800">Danh sách mặt hàng</h2>
            </div>
            
            {poLines.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Phiếu nhập kho này được tạo tự động từ hệ thống cũ (Tồn kho đầu kỳ). Vui lòng xem chi tiết ở báo cáo Tồn Kho.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Mặt hàng</th>
                    <th className="px-4 py-3">Đơn vị</th>
                    <th className="px-4 py-3 text-right">Số lượng</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-4 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {poLines.map((line: any, idx: number) => {
                    const item = allItems.find((i:any) => i.id === line.purchased_item_id);
                    const unitName = allUnits.find((u:any) => u.id === line.unit)?.name || line.unit;
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item?.name || line.purchased_item_id}</td>
                        <td className="px-4 py-3 text-gray-600">{unitName}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">{Number(line.quantity).toLocaleString("vi-VN")}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{Number(line.unit_price).toLocaleString('vi-VN')} đ</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-bold">{Number(line.subtotal).toLocaleString('vi-VN')} đ</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 mb-4">Thông tin thanh toán</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Tổng tiền hàng:</span>
                <span className="font-medium text-gray-900">{Number(po.subtotal_amount || 0).toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Phí vận chuyển:</span>
                <span className="font-medium text-gray-900">+{Number(po.shipping_fee || 0).toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Thuế:</span>
                <span className="font-medium text-gray-900">+{Number(po.tax_amount || 0).toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Voucher/Giảm giá:</span>
                <span className="font-medium text-red-600">-{Number((Number(po.voucher_amount || 0) + Number(po.discount_amount || 0))).toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between font-bold text-base">
                <span className="text-gray-900">Tổng cộng:</span>
                <span className="text-indigo-600">{Number(po.total_amount || 0).toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200/60 text-sm text-gray-600">
            <h3 className="font-bold text-gray-800 mb-2">Thông tin chứng từ</h3>
            <div className="space-y-2">
              <p><span className="font-medium">Mã hoá đơn:</span> {po.supplier_invoice_code || "Không có"}</p>
              <p><span className="font-medium">Nguồn nhập:</span> {allSources.find((s:any) => s.id === po.source_id)?.name || po.source_id || "Không xác định"}</p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200/60 text-sm text-gray-600">
            <h3 className="font-bold text-gray-800 mb-2">Ghi chú</h3>
            <p>{po.notes || "Không có ghi chú"}</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
