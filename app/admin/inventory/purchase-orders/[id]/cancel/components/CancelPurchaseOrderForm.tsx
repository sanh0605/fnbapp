"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/shared/format";
import { cancelPurchaseOrder, type PurchaseOrderCancelView } from "@/app/admin/inventory/purchase-orders/actions";

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
            <h2 className="font-bold text-text-primary">Hàng trong phiếu</h2>
          </div>

          {lines.length === 0 ? (
            <div className="p-6 text-center text-text-muted">
              Phiếu nhập kho này được tạo tự động từ hệ thống cũ (Tồn kho đầu kỳ). Vui lòng xem chi tiết ở báo cáo Tồn Kho.
            </div>
          ) : (
            <>
              {/* Desktop Table (hidden below lg) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-sm" data-testid="desktop-lines-table">
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
                    {lines.map((line) => (
                      <tr key={line.id} className="hover:bg-surface-secondary/50">
                        <td className="px-4 py-3 font-medium text-text-primary">{line.itemName}</td>
                        <td className="px-4 py-3 text-text-secondary">{line.unitName}</td>
                        <td className="px-4 py-3 text-right text-text-primary font-medium">
                          {Number(line.quantity).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3 text-right text-text-muted">
                          {formatNumber(line.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary font-bold">
                          {formatNumber(line.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone Cards (lg:hidden) */}
              <div className="p-4 space-y-3 lg:hidden" data-testid="phone-lines-list">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="p-3 rounded-lg border border-border bg-surface-card flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-text-primary truncate">{line.itemName}</p>
                      <p className="text-xs text-text-muted">
                        {Number(line.quantity).toLocaleString("vi-VN")} · {line.unitName} · {formatNumber(line.unitPrice)}
                      </p>
                    </div>
                    <div className="text-right font-bold text-text-primary whitespace-nowrap">
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
              <h2 className="font-bold text-text-primary">Tài sản sẽ ngừng</h2>
            </div>
            <div className="p-4 text-sm text-text-secondary border-b border-border">
              Các tài sản sau sẽ ngừng, khấu hao đã tính cho các tháng trước được gỡ ra:
            </div>

            {/* Desktop Table (hidden below lg) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="desktop-assets-table">
                <thead className="bg-surface-secondary text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Mã</th>
                    <th className="px-4 py-3">Tên</th>
                    <th className="px-4 py-3 text-right">Số lượng</th>
                    <th className="px-4 py-3 text-right">Nguyên giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-surface-secondary/50">
                      <td className="px-4 py-3 font-medium text-text-primary">{asset.id}</td>
                      <td className="px-4 py-3 text-text-primary">{asset.name}</td>
                      <td className="px-4 py-3 text-right text-text-primary font-medium">{asset.quantity}</td>
                      <td className="px-4 py-3 text-right text-text-primary font-bold">
                        {formatNumber(asset.totalCost)}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone Cards (lg:hidden) */}
            <div className="p-4 space-y-3 lg:hidden" data-testid="phone-assets-list">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-3 rounded-lg border border-border bg-surface-card flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-text-primary">{asset.name}</p>
                    <p className="text-xs text-text-muted">
                      {asset.id} · SL {asset.quantity}
                    </p>
                  </div>
                  <div className="text-right font-bold text-text-primary whitespace-nowrap">
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
          <h2 className="font-bold text-text-primary">Thông tin thanh toán</h2>
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
            <div className="pt-3 border-t border-border flex justify-between font-bold text-base">
              <span className="text-text-primary">Tổng cộng:</span>
              <span className="text-primary">{formatNumber(order.totalAmount)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-border text-sm text-text-secondary space-y-2">
            <p>
              Hình thức thanh toán: <strong className="text-text-primary">{order.paymentLabel}</strong>
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
            <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger text-sm space-y-2">
              {blockedMessages.map((msg, idx) => (
                <p key={idx}>{msg}</p>
              ))}
            </div>
            <div>
              <Link
                href={detailHref}
                className="w-full inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-medium bg-surface-secondary text-text-primary hover:bg-surface-secondary/80 border border-border transition min-h-[44px]"
              >
                Quay lại
              </Link>
            </div>
          </div>
        ) : (
          <div className="order-4 bg-surface-card rounded-xl shadow-sm border border-border p-5 space-y-4">
            <p className="text-text-secondary text-sm">
              Phiếu sẽ không còn tính vào tồn kho, giá vốn, lãi lỗ và sổ thu chi từ ngày {order.dateText}.
            </p>

            {errorLines.length > 0 && (
              <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger text-sm space-y-1">
                {errorLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="cancel-reason" className="block text-sm font-medium text-text-primary">
                Lý do huỷ (bắt buộc)
              </label>
              <textarea
                id="cancel-reason"
                rows={4}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do huỷ phiếu…"
                className="w-full border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card text-text-primary resize-y"
              />
              <div className="text-right text-xs text-text-muted">
                {reason.length}/500
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={!reason.trim() || isSubmitting}
                className="w-full px-5 py-2.5 rounded-lg font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[44px] flex items-center justify-center"
              >
                Xác nhận huỷ
              </button>
              <Link
                href={detailHref}
                className="w-full px-5 py-2.5 rounded-lg font-medium text-center bg-surface-secondary text-text-primary hover:bg-surface-secondary/80 border border-border transition min-h-[44px] flex items-center justify-center"
              >
                Quay lại
              </Link>
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
