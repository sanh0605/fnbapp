import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { redirect, notFound } from "next/navigation";
import { findById, findAll } from "@/lib/db/tables";
import PurchaseOrderForm from "../components/PurchaseOrderForm";
import PurchasePaymentBlock from "./components/PurchasePaymentBlock";
import { formatDecimal, formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { resolvePurchaseOrderEditGate } from "@/lib/purchasing/purchase-order-edit-gate";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MoneySummary } from "@/components/ui/MoneySummary";
import { FieldList } from "@/components/ui/detail/FieldList";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { edit?: string; returnTo?: string; assetWarning?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as any)?.role || "STAFF";

  const [po, lines, allItems, allUnits, allSuppliers, allConversions, allSources, allBankAccounts] =
    await Promise.all([
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

  const rawReturnTo = searchParams?.returnTo;
  const returnTo =
    typeof rawReturnTo === "string" &&
    (rawReturnTo === "/admin/inventory/purchase-orders" ||
      rawReturnTo.startsWith("/admin/inventory/purchase-orders?"))
      ? rawReturnTo
      : "/admin/inventory/purchase-orders";

  const poLines = lines.filter(
    (l: any) => l.po_id === params.id || l.purchase_order_id === params.id
  );
  const isDraft = po.status === "DRAFT";
  const isCancelled = po.status === "CANCELLED";
  const isAdmin = role === "ADMIN";
  const bankAccounts = (allBankAccounts as any[]).filter(
    (a) => a.status === "ACTIVE" || a.id === po?.bank_account_id
  );
  const editRequested = searchParams?.edit === "1";
  const { showForm } = resolvePurchaseOrderEditGate({
    role,
    editRequested: editRequested && !isCancelled,
    isDraft,
  });

  const canEditOrder = po.status === "COMPLETED" && isAdmin && !showForm;
  const canCancel =
    (role === "ADMIN" || role === "MANAGER") &&
    !isCancelled &&
    ((po.status === "COMPLETED" && !showForm) || isDraft);
  const canClone = (role === "ADMIN" || role === "MANAGER") && !showForm;

  const actions = (
    <>
      {canEditOrder && (
        <Button
          href={`/admin/inventory/purchase-orders/${po.id}?edit=1`}
          variant="secondary"
        >
          Sửa phiếu
        </Button>
      )}
      {canCancel && (
        <Button
          href={`/admin/inventory/purchase-orders/${po.id}/cancel`}
          variant="delete"
        >
          Huỷ phiếu
        </Button>
      )}
      {canClone && (
        <Button
          href={`/admin/inventory/purchase-orders/new?copyFrom=${encodeURIComponent(po.id)}`}
          variant="secondary"
        >
          Nhân bản
        </Button>
      )}
    </>
  );

  const badge = (
    <Badge
      variant={
        po.status === "COMPLETED"
          ? "success"
          : isCancelled
          ? "neutral"
          : "warning"
      }
    >
      {po.status === "COMPLETED"
        ? "Đã hoàn thành"
        : isCancelled
        ? "Đã huỷ"
        : "Nháp"}
    </Badge>
  );

  const subtitle = `Ngày tạo: ${formatDateTimeFull(po.created_at)} | Ngày giao dịch: ${
    po.transaction_date ? formatDateTimeFull(po.transaction_date) : "N/A"
  }`;

  return (
    <div className="space-y-6">
      {searchParams?.assetWarning === "1" && (
        <div
          role="status"
          className="p-4 rounded-xl border border-warning/40 bg-warning/10 text-warning-active text-sm font-medium"
        >
          Phiếu đã lưu, nhưng tài sản sinh từ phiếu này chưa ghi được. Mở trang Tài sản để kiểm lại; sửa phiếu lần sau không tự ghi bù.
        </div>
      )}
      <DetailHeader
        backHref={returnTo}
        backLabel="Phiếu nhập"
        title={`${isDraft ? "Tiếp tục tạo phiếu nhập" : "Chi tiết phiếu nhập"}: ${po.id}`}
        subtitle={subtitle}
        badge={badge}
        actions={actions}
      />

      {isCancelled && (
        <div className="p-4 rounded-xl border border-border bg-surface-secondary/50 text-text-secondary text-sm">
          Lý do huỷ: {po.cancel_reason} · Huỷ bởi {po.cancelled_by_name} lúc{" "}
          {formatDateTimeFull(po.cancelled_at)}
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
                <h2 className="text-base font-semibold text-text-primary">Danh sách mặt hàng</h2>
              </div>

              {poLines.length === 0 ? (
                <div className="p-6 text-center text-text-muted">
                  Phiếu nhập kho này được tạo tự động từ hệ thống cũ (Tồn kho đầu kỳ). Vui lòng xem chi tiết ở báo cáo Tồn Kho.
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHead>
                        <TableHeaderCell>Mặt hàng</TableHeaderCell>
                        <TableHeaderCell>Đơn vị</TableHeaderCell>
                        <TableHeaderCell>Số lượng</TableHeaderCell>
                        <TableHeaderCell>Đơn giá</TableHeaderCell>
                        <TableHeaderCell>Thành tiền</TableHeaderCell>
                      </TableHead>
                      <TableBody>
                        {poLines.map((line: any, idx: number) => {
                          const item = allItems.find((i: any) => i.id === line.purchased_item_id);
                          const unitName =
                            allUnits.find((u: any) => u.id === line.unit)?.name || line.unit;

                          return (
                            <TableRow key={idx}>
                              <TableCell>{item?.name || line.purchased_item_id}</TableCell>
                              <TableCell>{unitName}</TableCell>
                              <TableCell align="right">
                                {formatDecimal(Number(line.quantity), { maxDigits: 3 })}
                              </TableCell>
                              <TableCell align="right">{formatNumber(line.unit_price)}</TableCell>
                              <TableCell align="right">{formatNumber(line.subtotal)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="md:hidden flex flex-col divide-y divide-border">
                    {poLines.map((line: any, idx: number) => {
                      const item = allItems.find((i: any) => i.id === line.purchased_item_id);
                      const unitName =
                        allUnits.find((u: any) => u.id === line.unit)?.name || line.unit;

                      return (
                        <div key={idx} className="p-4 space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <div className="text-sm font-medium text-text-primary">
                              {item?.name || line.purchased_item_id}
                            </div>
                            <div className="text-sm font-medium text-text-primary tabular-nums">
                              {formatNumber(line.subtotal)}đ
                            </div>
                          </div>
                          <div className="text-xs text-text-secondary">
                            {formatDecimal(Number(line.quantity), { maxDigits: 3 })} {unitName} ×{" "}
                            {formatNumber(line.unit_price)}đ
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-text-primary">Thông tin thanh toán</h2>
              <MoneySummary
                lines={[
                  {
                    label: "Tổng tiền hàng",
                    value: formatNumber(po.subtotal_amount),
                  },
                  {
                    label: "Phí vận chuyển",
                    value: `+${formatNumber(po.shipping_fee)}`,
                  },
                  {
                    label: "Thuế",
                    value: `+${formatNumber(po.tax_amount)}`,
                  },
                  {
                    label: "Voucher/Giảm giá",
                    value: `-${formatNumber(
                      Number(po.voucher_amount || 0) + Number(po.discount_amount || 0)
                    )}`,
                  },
                ]}
                total={{
                  label: "Tổng cộng",
                  value: formatNumber(po.total_amount),
                }}
              />

              {(po.status === "COMPLETED" || isCancelled) && (
                <div className="bg-surface-card rounded-xl border border-border p-4">
                  <PurchasePaymentBlock
                    paymentMethod={po.payment_method}
                    bankAccountId={po.bank_account_id}
                    bankAccounts={bankAccounts}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-text-primary">Thông tin chứng từ</h3>
              <FieldList
                fields={[
                  {
                    label: "Mã hoá đơn",
                    value: po.supplier_invoice_code || "Không có",
                  },
                  {
                    label: "Nguồn nhập",
                    value:
                      allSources.find((s: any) => s.id === po.source_id)?.name ||
                      po.source_id ||
                      "Không xác định",
                  },
                ]}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-text-primary">Ghi chú</h3>
              <div className="bg-surface-card rounded-2xl border border-border p-4 text-sm text-text-primary font-normal">
                {po.notes || "Không có ghi chú"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
