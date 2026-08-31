import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { findById, findAll } from "@/lib/sheets_db";
import Link from "next/link";
import { notFound } from "next/navigation";
import PurchaseOrderForm from "../components/PurchaseOrderForm";
import { formatNumber } from "@/lib/format";
import { resolvePurchaseOrderEditGate } from "@/lib/purchase-order-edit-gate";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { edit?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as any)?.role || "STAFF";

  const [po, lines, allItems, allUnits, allSuppliers, allConversions, allSources] = await Promise.all([
    findById("Purchase_Orders", params.id),
    findAll("Purchase_Order_Lines"),
    findAll("Purchased_Items"),
    findAll("Units"),
    findAll("Suppliers"),
    findAll("UOM_Conversions"),
    findAll("Purchase_Sources")
  ]);

  if (!po) {
    notFound();
  }

  const poLines = lines.filter((l: any) => (l.po_id === params.id || l.purchase_order_id === params.id));
  const isDraft = po.status === "DRAFT";
  const isAdmin = role === "ADMIN";
  const editRequested = searchParams?.edit === "1";
  const { showForm } = resolvePurchaseOrderEditGate({ role, editRequested, isDraft });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/inventory/purchase-orders" className="p-2 bg-surface-card rounded-lg border border-border hover:bg-surface-secondary transition">
          Quay lại
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{isDraft ? "Tiếp tục tạo Phiếu Nhập Kho" : "Chi tiết Phiếu Nhập Kho"}: {po.id}</h1>
          <p className="text-text-muted">Ngày tạo: {new Date(po.created_at).toLocaleString('vi-VN')} | Ngày giao dịch: {po.transaction_date ? new Date(po.transaction_date).toLocaleString('vi-VN') : 'N/A'}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`px-3 py-1 text-sm font-bold rounded-full ${po.status === 'COMPLETED' ? 'bg-success/20 text-success-active' : 'bg-warning/20 text-warning-active'}`}>
            {po.status === 'COMPLETED' ? 'Đã Hoàn Thành' : 'Nháp'}
          </span>
          {po.status === 'COMPLETED' && isAdmin && !showForm && (
            <Link
              href={`/admin/inventory/purchase-orders/${po.id}?edit=1`}
              className="px-3 py-1 text-sm font-bold rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition"
            >
              Sửa phiếu
            </Link>
          )}
        </div>
      </div>

      {showForm ? (
        <>
          {!isDraft && (
            <div className="p-4 rounded-xl border border-warning/40 bg-warning/10 text-warning-active text-sm font-medium">
              Sửa phiếu đã hoàn thành sẽ ghi lại tồn kho và giá vốn của phiếu này. Kiểm tra kỹ trước khi lưu.
            </div>
          )}
          <PurchaseOrderForm
            suppliers={allSuppliers}
            sources={allSources}
            items={allItems}
            conversions={allConversions}
            units={allUnits}
            initialData={{ po, lines: poLines }}
          />
        </>
      ) : (

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-secondary/50">
              <h2 className="font-bold text-text-primary">Danh sách mặt hàng</h2>
            </div>
            
            {poLines.length === 0 ? (
              <div className="p-6 text-center text-text-muted">
                Phiếu nhập kho này được tạo tự động từ hệ thống cũ (Tồn kho đầu kỳ). Vui lòng xem chi tiết ở báo cáo Tồn Kho.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-secondary text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Mặt hàng</th>
                    <th className="px-4 py-3">Đơn vị</th>
                    <th className="px-4 py-3 text-right">Số lượng</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-4 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {poLines.map((line: any, idx: number) => {
                    const item = allItems.find((i:any) => i.id === line.purchased_item_id);
                    const unitName = allUnits.find((u:any) => u.id === line.unit)?.name || line.unit;
                    
                    return (
                      <tr key={idx} className="hover:bg-surface-secondary/50">
                        <td className="px-4 py-3 font-medium text-text-primary">{item?.name || line.purchased_item_id}</td>
                        <td className="px-4 py-3 text-text-secondary">{unitName}</td>
                        <td className="px-4 py-3 text-right text-text-primary font-medium">{Number(line.quantity).toLocaleString("vi-VN")}</td>
                        <td className="px-4 py-3 text-right text-text-muted">{formatNumber(line.unit_price)}</td>
                        <td className="px-4 py-3 text-right text-text-primary font-bold">{formatNumber(line.subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-card rounded-xl shadow-sm border border-border p-5">
            <h2 className="font-bold text-text-primary mb-4">Thông tin thanh toán</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Tổng tiền hàng:</span>
                <span className="font-medium text-text-primary">{formatNumber(po.subtotal_amount)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Phí vận chuyển:</span>
                <span className="font-medium text-text-primary">+{formatNumber(po.shipping_fee)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Thuế:</span>
                <span className="font-medium text-text-primary">+{formatNumber(po.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Voucher/Giảm giá:</span>
                <span className="font-medium text-danger">-{formatNumber(Number(po.voucher_amount || 0) + Number(po.discount_amount || 0))}</span>
              </div>
              <div className="pt-3 border-t border-border flex justify-between font-bold text-base">
                <span className="text-text-primary">Tổng cộng:</span>
                <span className="text-primary">{formatNumber(po.total_amount)}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-secondary rounded-xl p-5 border border-border/60 text-sm text-text-secondary">
            <h3 className="font-bold text-text-primary mb-2">Thông tin chứng từ</h3>
            <div className="space-y-2">
              <p><span className="font-medium">Mã hoá đơn:</span> {po.supplier_invoice_code || "Không có"}</p>
              <p><span className="font-medium">Nguồn nhập:</span> {allSources.find((s:any) => s.id === po.source_id)?.name || po.source_id || "Không xác định"}</p>
            </div>
          </div>
          
          <div className="bg-surface-secondary rounded-xl p-5 border border-border/60 text-sm text-text-secondary">
            <h3 className="font-bold text-text-primary mb-2">Ghi chú</h3>
            <p>{po.notes || "Không có ghi chú"}</p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
