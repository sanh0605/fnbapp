"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDecimal, formatNumber } from "@/lib/shared/format";
import { cancelPurchaseOrder, type PurchaseOrderCancelView } from "@/app/admin/inventory/purchase-orders/actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";

export type ReadyCancelView = Extract<PurchaseOrderCancelView, { state: "ready" }>;

interface CancelPurchaseOrderFormProps {
  view: ReadyCancelView;
}

export function CancelPurchaseOrderForm({ view }: CancelPurchaseOrderFormProps) {
  const router = useRouter();
  const { order, lines, blockedMessages, assets } = view;

  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorLines, setErrorLines] = useState<string[]>([]);

  const detailHref = `/admin/inventory/purchase-orders/${order.id}`;
  const isBlocked = blockedMessages.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorLines([]);

    try {
      const res = await cancelPurchaseOrder({ id: order.id, reason });
      if (res.success) {
        router.push(detailHref);
        router.refresh();
      } else {
        const errorText = res.error || "Có lỗi xảy ra khi huỷ phiếu";
        setErrorLines(errorText.split("\n"));
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Có lỗi xảy ra khi huỷ phiếu";
      setErrorLines(msg.split("\n"));
      setIsSubmitting(false);
    }
  }

  const content = (
    <>
      {/* Left Column on Desktop / 2nd & 3rd on Phone */}
      <div className="contents lg:block lg:col-span-2 lg:space-y-6">
        {/* Card: Hàng trong phiếu */}
        <div className="order-2 bg-surface-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-secondary/50">
            <h2 className="font-semibold text-text-primary">Hàng trong phiếu</h2>
          </div>

          {lines.length === 0 ? (
            <div className="p-6 text-center text-text-muted">
              Phiếu nhập kho này được tạo tự động từ hệ thống cũ (Tồn kho đầu kỳ). Vui lòng xem chi tiết ở báo cáo Tồn Kho.
            </div>
          ) : (
            <>
              {/* Desktop Table (hidden below lg) */}
              <div className="hidden lg:block overflow-x-auto" data-testid="desktop-lines-table">
                <Table>
                  <TableHead>
                    <TableHeaderCell>Mặt hàng</TableHeaderCell>
                    <TableHeaderCell>Đơn vị</TableHeaderCell>
                    <TableHeaderCell>Số lượng</TableHeaderCell>
                    <TableHeaderCell>Đơn giá</TableHeaderCell>
                    <TableHeaderCell>Thành tiền</TableHeaderCell>
                  </TableHead>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.unitName}</TableCell>
                        <TableCell align="right">
                          {formatDecimal(Number(line.quantity), { maxDigits: 3 })}
                        </TableCell>
                        <TableCell align="right">{formatNumber(line.unitPrice)}</TableCell>
                        <TableCell align="right">{formatNumber(line.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Phone Cards (lg:hidden) */}
              <div className="p-4 space-y-3 lg:hidden" data-testid="phone-lines-list">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="p-3 rounded-lg border border-border bg-surface-card flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-primary break-words">{line.itemName}</p>
                      <p className="text-xs text-text-muted">
                        {formatDecimal(Number(line.quantity), { maxDigits: 3 })} · {line.unitName} · {formatNumber(line.unitPrice)}
                      </p>
                    </div>
                    <div className="text-right font-medium text-text-primary whitespace-nowrap">
                      {formatNumber(line.subtotal)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Card: Tài sản sẽ ngừng (if assets.length > 0) */}
        {assets.length > 0 && (
          <div className="order-3 bg-surface-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-surface-secondary/50">
              <h2 className="font-semibold text-text-primary">Tài sản sẽ ngừng</h2>
            </div>
            <div className="p-4 text-sm text-text-secondary border-b border-border">
              Các tài sản sau sẽ ngừng, khấu hao đã tính cho các tháng trước được gỡ ra:
            </div>

            {/* Desktop Table (hidden below lg) */}
            <div className="hidden lg:block overflow-x-auto" data-testid="desktop-assets-table">
              <Table>
                <TableHead>
                  <TableHeaderCell>Mặt hàng</TableHeaderCell>
                  <TableHeaderCell>Mã</TableHeaderCell>
                  <TableHeaderCell>Tên</TableHeaderCell>
                  <TableHeaderCell>Số lượng</TableHeaderCell>
                  <TableHeaderCell>Nguyên giá</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>{asset.id}</TableCell>
                      <TableCell>{asset.name}</TableCell>
                      <TableCell align="right">{asset.quantity}</TableCell>
                      <TableCell align="right">{formatNumber(asset.totalCost)}đ</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phone Cards (lg:hidden) */}
            <div className="p-4 space-y-3 lg:hidden" data-testid="phone-assets-list">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-3 rounded-lg border border-border bg-surface-card flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary">{asset.name}</p>
                    <p className="text-xs text-text-muted">
                      {asset.id} · SL {asset.quantity}
                    </p>
                  </div>
                  <div className="text-right font-medium text-text-primary whitespace-nowrap">
                    {formatNumber(asset.totalCost)}đ
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column on Desktop / 1st & 4th on Phone */}
      <div className="contents lg:block lg:col-span-1 lg:space-y-6">
        {/* Money Card */}
        <div className="order-1 bg-surface-card rounded-xl shadow-sm border border-border p-5 space-y-4" data-testid="money-card">
          <h2 className="font-semibold text-text-primary">Thông tin thanh toán</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Tổng tiền hàng:</span>
              <span className="font-medium text-text-primary">{formatNumber(order.subtotalAmount)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Phí vận chuyển:</span>
              <span className="font-medium text-text-primary">+{formatNumber(order.shippingFee)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Thuế:</span>
              <span className="font-medium text-text-primary">+{formatNumber(order.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Voucher/Giảm giá:</span>
              <span className="font-medium text-danger">-{formatNumber(order.discountTotal)}</span>
            </div>
            <div className="pt-3 border-t border-border flex justify-between font-semibold text-base">
              <span className="text-text-primary">Tổng cộng:</span>
              <span className="text-primary">{formatNumber(order.totalAmount)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-border text-sm text-text-secondary space-y-2">
            <p>
              Hình thức thanh toán: <span className="font-medium text-text-primary">{order.paymentLabel}</span>
            </p>
            <div className="pt-2 border-t border-border/60 text-xs text-text-muted space-y-1">
              <p>
                Mã hoá đơn: <span className="text-text-secondary">{order.invoiceCode || "Không có"}</span>
              </p>
              <p>
                Nguồn nhập: <span className="text-text-secondary">{order.sourceName}</span>
              </p>
              {Boolean(order.notes && order.notes.trim()) && (
                <p>
                  Ghi chú: <span className="text-text-secondary">{order.notes}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cancel Card or Blocked Block */}
        {isBlocked ? (
          <div className="order-4 space-y-4">
            <Alert variant="warning" className="space-y-2">
              {blockedMessages.map((msg, idx) => (
                <p key={idx}>{msg}</p>
              ))}
            </Alert>
            <div>
              <Button
                href={detailHref}
                variant="secondary"
                className="w-full"
              >
                Quay lại
              </Button>
            </div>
          </div>
        ) : (
          <div className="order-4 bg-surface-card rounded-xl shadow-sm border border-border p-5 space-y-4">
            <p className="text-text-secondary text-sm">
              Phiếu sẽ không còn tính vào tồn kho, giá vốn, lãi lỗ và sổ thu chi từ ngày {order.dateText}.
            </p>

            {errorLines.length > 0 && (
              <Alert variant="danger" className="space-y-1">
                {errorLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </Alert>
            )}

            <div className="space-y-1.5">
              <Field label="Lý do huỷ" htmlFor="cancel-reason" required>
                <textarea
                  id="cancel-reason"
                  aria-label="Lý do huỷ (bắt buộc)"
                  rows={4}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: nhập trùng phiếu"
                  className="w-full border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card text-text-primary resize-y"
                />
              </Field>
              <div className="text-right text-xs text-text-muted">
                {reason.length}/500
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="submit"
                variant="danger"
                loading={isSubmitting}
                disabled={!reason.trim() || isSubmitting}
                className="w-full"
              >
                Xác nhận huỷ
              </Button>
              <Button
                href={detailHref}
                variant="secondary"
                className="w-full"
              >
                Quay lại
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (isBlocked) {
    return (
      <div className="w-full flex flex-col gap-6 lg:grid lg:grid-cols-3">
        {content}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 lg:grid lg:grid-cols-3">
      {content}
    </form>
  );
}

export default CancelPurchaseOrderForm;
