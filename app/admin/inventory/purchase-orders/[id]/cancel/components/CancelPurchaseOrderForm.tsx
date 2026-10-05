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
  const { order, blockedMessages, assets } = view;

  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorLines, setErrorLines] = useState<string[]>([]);

  const detailHref = `/admin/inventory/purchase-orders/${order.id}`;

  if (blockedMessages.length > 0) {
    return (
      <div className="space-y-6 max-w-2xl">
        {/* Summary card */}
        <div className="bg-surface-card rounded-xl border border-border p-5 space-y-2 text-sm text-text-secondary">
          <p>Mã phiếu: <strong className="text-text-primary">{order.id}</strong></p>
          <p>Ngày nhập: <strong className="text-text-primary">{order.dateText}</strong></p>
          <p>Nhà cung cấp: <strong className="text-text-primary">{order.supplierName}</strong></p>
          <p>Tổng cộng: <strong className="text-text-primary">{formatNumber(order.totalAmount)}đ</strong></p>
          <p>Trả bằng: <strong className="text-text-primary">{order.paymentLabel}</strong></p>
        </div>

        {/* Danger-tinted block with no title */}
        <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger text-sm space-y-2">
          {blockedMessages.map((msg, idx) => (
            <p key={idx}>{msg}</p>
          ))}
        </div>

        <div>
          <Link
            href={detailHref}
            className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-medium bg-surface-secondary text-text-primary hover:bg-surface-secondary/80 border border-border transition min-h-[44px]"
          >
            Quay lại
          </Link>
        </div>
      </div>
    );
  }

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Summary card */}
      <div className="bg-surface-card rounded-xl border border-border p-5 space-y-2 text-sm text-text-secondary">
        <p>Mã phiếu: <strong className="text-text-primary">{order.id}</strong></p>
        <p>Ngày nhập: <strong className="text-text-primary">{order.dateText}</strong></p>
        <p>Nhà cung cấp: <strong className="text-text-primary">{order.supplierName}</strong></p>
        <p>Tổng cộng: <strong className="text-text-primary">{formatNumber(order.totalAmount)}đ</strong></p>
        <p>Trả bằng: <strong className="text-text-primary">{order.paymentLabel}</strong></p>
      </div>

      {/* 1. Paragraph */}
      <p className="text-text-secondary text-sm">
        Phiếu sẽ không còn tính vào tồn kho, giá vốn, lãi lỗ và sổ thu chi từ ngày {order.dateText}.
      </p>

      {/* 2. Assets if any */}
      {assets.length > 0 && (
        <div className="space-y-2">
          <p className="text-text-secondary text-sm">
            Các tài sản sau sẽ ngừng, khấu hao đã tính cho các tháng trước được gỡ ra:
          </p>
          <div className="space-y-1 text-sm text-text-secondary bg-surface-secondary/50 p-4 rounded-xl border border-border">
            {assets.map((asset) => (
              <p key={asset.id}>
                {asset.id} · {asset.name} · SL {asset.quantity} · {formatNumber(asset.totalCost)}đ
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Error messages if submit failed */}
      {errorLines.length > 0 && (
        <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger text-sm space-y-1">
          {errorLines.map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
      )}

      {/* 3. Reason textarea */}
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

      {/* 4. Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!reason.trim() || isSubmitting}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[44px] flex items-center justify-center"
        >
          Xác nhận huỷ
        </button>
        <Link
          href={detailHref}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg font-medium text-center bg-surface-secondary text-text-primary hover:bg-surface-secondary/80 border border-border transition min-h-[44px] flex items-center justify-center"
        >
          Quay lại
        </Link>
      </div>
    </form>
  );
}

export default CancelPurchaseOrderForm;
