import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { findById, findAll } from "@/lib/db/tables";
import Link from "next/link";
import { notFound } from "next/navigation";
import PurchaseOrderForm from "../components/PurchaseOrderForm";
import PurchasePaymentBlock from "./components/PurchasePaymentBlock";
import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { resolvePurchaseOrderEditGate } from "@/lib/purchasing/purchase-order-edit-gate";

import { BackLink } from "@/components/ui/BackLink";

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

  const [po, lines, allItems, allUnits, allSuppliers, allConversions, allSources, allBankAccounts] = await Promise.all([
    findById("Purchase_Orders", params.id),
    findAll("Purchase_Order_Lines"),
    findAll("Purchased_Items"),
    findAll("Units"),
    findAll("Suppliers"),
    findAll("UOM_Conversions"),
    findAll("Purchase_Sources"),
    findAll("Bank_Accounts"),
  ]);

  if (!po) {
    notFound();
  }

  const poLines = lines.filter((l: any) => (l.po_id === params.id || l.purchase_order_id === params.id));
  const isDraft = po.status === "DRAFT";
  const isCancelled = po.status === "CANCELLED";
  const isAdmin = role === "ADMIN";
  const canEditPayment = role === "ADMIN" || role === "MANAGER";
  const bankAccounts = (allBankAccounts as any[]).filter(a => a.status === "ACTIVE" || a.id === po?.bank_account_id);
  const editRequested = searchParams?.edit === "1";
  const { showForm } = resolvePurchaseOrderEditGate({ role, editRequested: editRequested && !isCancelled, isDraft });

  return (
    <div className="space-y-6">
      <BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{isDraft ? "Tiếp tục tạo Phiếu Nhập Kho" : "Chi tiết Phiếu Nhập Kho"}: {po.id}</h1>
          <p className="text-text-muted">Ngày tạo: {formatDateTimeFull(po.created_at)} | Ngày giao dịch: {po.transaction_date ? formatDateTimeFull(po.transaction_date) : 'N/A'}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`px-3 py-1 text-sm font-bold rounded-full ${
              po.status === "COMPLETED"
                ? "bg-success/20 text-success-active"
                : isCancelled
                ? "bg-surface-secondary text-text-muted"
                : "bg-warning/20 text-warning-active"
            }`}
          >
            {po.status === "COMPLETED" ? "Đã Hoàn Thành" : isCancelled ? "Đã huỷ" : "Nháp"}
          </span>
          {po.status === "COMPLETED" && isAdmin && !showForm && (
            <Link
              href={`/admin/inventory/purchase-orders/${po.id}?edit=1`}
              className="px-3 py-1 text-sm font-bold rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition"
            >
              Sửa phiếu
            </Link>
          )}
          {(po.status === "COMPLETED" || po.status === "DRAFT") && (role === "ADMIN" || role === "MANAGER") && !showForm && (
            <Link
              href={`/admin/inventory/purchase-orders/${po.id}/cancel`}
              className="px-3 py-1 text-sm font-bold rounded-full border border-danger text-danger hover:bg-danger/10 transition"
            >
              Huỷ phiếu
            </Link>
          )}
        </div>
      </div>

      {isCancelled && (
        <div className="p-4 rounded-xl border border-border bg-surface-secondary/50 text-text-secondary text-sm">
          Lý do huỷ: {po.cancel_reason} · Huỷ bởi {po.cancelled_by_name} lúc {formatDateTimeFull(po.cancelled_at)}
        </div>
      )}

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
            bankAccounts={bankAccounts}
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

            {(po.status === "COMPLETED" || isCancelled) && (
              <PurchasePaymentBlock
                poId={po.id}
                paymentMethod={po.payment_method}
                bankAccountId={po.bank_account_id}
                bankAccounts={bankAccounts}
                canEdit={canEditPayment && !isCancelled}
              />
            )}
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
