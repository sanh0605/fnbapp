"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDecimal, formatNumber } from "@/lib/shared/format";
import { cancelPurchaseOrder, type PurchaseOrderCancelView } from "@/app/admin/inventory/purchase-orders/actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { MoneySummary } from "@/components/ui/MoneySummary";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
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
                        <TableCell align="right">{formatNumber(line.unitPrice)}đ</TableCell>
                        <TableCell align="right">{formatNumber(line.subtotal)}đ</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Phone Lines (lg:hidden) */}
              <div className="divide-y divide-border lg:hidden" data-testid="phone-lines-list">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-primary break-words">{line.itemName}</p>
                      <p className="text-xs text-text-muted">
                        {formatDecimal(Number(line.quantity), { maxDigits: 3 })} {line.unitName} × {formatNumber(line.unitPrice)}đ
                      </p>
                    </div>
                    <div className="text-right font-medium text-text-primary whitespace-nowrap">
                      {formatNumber(line.subtotal)}đ
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

            {/* Phone Rows (lg:hidden) */}
            <div className="divide-y divide-border lg:hidden" data-testid="phone-assets-list">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="px-4 py-3 min-h-[48px] md:min-h-[40px] flex flex-col justify-center"
                >
                  <PhoneRow
                    title={asset.name}
                    meta={`${asset.id} · SL ${asset.quantity}`}
                    value={`${formatNumber(asset.totalCost)}đ`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column on Desktop / 1st & 4th on Phone */}
      <div className="contents lg:block lg:col-span-1 lg:space-y-6">
        {/* Money Card */}
        <div className="order-1 space-y-4" data-testid="money-card">
          <h2 className="font-semibold text-text-primary">Thông tin thanh toán</h2>
          <MoneySummary
            lines={[
              {
                label: "Tổng tiền hàng",
                value: `${formatNumber(order.subtotalAmount)}đ`,
              },
              {
                label: "Phí vận chuyển",
                value:
                  Number(order.shippingFee) === 0
                    ? "0đ"
                    : `+${formatNumber(order.shippingFee)}đ`,
              },
              {
                label: "Thuế",
                value:
                  Number(order.taxAmount) === 0
                    ? "0đ"
                    : `+${formatNumber(order.taxAmount)}đ`,
              },
              {
                label: "Voucher/Giảm giá",
                value:
                  Number(order.discountTotal) === 0
                    ? "0đ"
                    : `-${formatNumber(order.discountTotal)}đ`,
              },
            ]}
            total={{
              label: "Tổng cộng",
              value: `${formatNumber(order.totalAmount)}đ`,
            }}
          />

          <div className="bg-surface-card rounded-xl border border-border p-4 text-sm text-text-secondary space-y-2">
            <div className="flex justify-between items-start gap-2">
              <span className="text-sm text-text-secondary shrink-0">Hình thức thanh toán</span>
              <span className="text-sm text-text-primary font-medium text-right break-words min-w-0">{order.paymentLabel}</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="text-sm text-text-secondary shrink-0">Mã hoá đơn</span>
              <span className="text-sm text-text-primary text-right break-words min-w-0">{order.invoiceCode || "Không có"}</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="text-sm text-text-secondary shrink-0">Nguồn nhập</span>
              <span className="text-sm text-text-primary text-right break-words min-w-0">{order.sourceName}</span>
            </div>
            {Boolean(order.notes && order.notes.trim()) && (
              <div className="flex justify-between items-start gap-2">
                <span className="text-sm text-text-secondary shrink-0">Ghi chú</span>
                <span className="text-sm text-text-primary text-right break-words min-w-0">{order.notes}</span>
              </div>
            )}
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
                className="w-full min-h-[48px] md:min-h-[40px]"
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

            <div className="flex items-center gap-3 pt-2">
              <Button
                href={detailHref}
                variant="secondary"
                className="flex-1 min-h-[48px] md:min-h-[40px]"
              >
                Quay lại
              </Button>
              <Button
                type="submit"
                variant="danger"
                loading={isSubmitting}
                disabled={!reason.trim() || isSubmitting}
                className="flex-1 min-h-[48px] md:min-h-[40px]"
              >
                Xác nhận huỷ
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
