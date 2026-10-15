"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { voidOrderV2 } from "@/app/admin/orders/order-void-actions";
import type { OrderListItem } from "@/app/admin/orders/actions";

interface VoidOrderFormProps {
  order: OrderListItem;
  detailHref: string;
}

export function VoidOrderForm({ order, detailHref }: VoidOrderFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await voidOrderV2(order.id, trimmedReason);
      if (res.success) {
        router.push(detailHref);
        router.refresh();
      } else {
        setErrorMessage(res.error || "Huỷ đơn không thành, thử lại");
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage("Huỷ đơn không thành. Kiểm tra mạng rồi bấm lại.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left column: Summary (time, dishes with size and quantity, Khách trả) */}
      <div className="bg-surface-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-surface-secondary/50 flex justify-between items-center text-sm">
          <span className="font-semibold text-text-primary">Thông tin đơn hàng</span>
          <span className="text-text-secondary tabular-nums">{formatDateTimeFull(order.created_at)}</span>
        </div>

        {/* Computer Table (hidden on mobile) */}
        <div className="hidden lg:block overflow-x-auto" data-testid="desktop-lines-table">
          <Table>
            <TableHead>
              <TableHeaderCell>Món</TableHeaderCell>
              <TableHeaderCell>Size</TableHeaderCell>
              <TableHeaderCell>Tuỳ chọn</TableHeaderCell>
              <TableHeaderCell>SL</TableHeaderCell>
              <TableHeaderCell>Thành tiền</TableHeaderCell>
            </TableHead>
            <TableBody>
              {order.lines.map((line, idx) => {
                const modifiersText =
                  line.modifiers && line.modifiers.length > 0
                    ? line.modifiers
                        .map((m: any) => `${Number(m.qty || 1) > 1 ? `${m.qty}x ` : ""}${m.name}`)
                        .join(", ")
                    : "";

                return (
                  <TableRow key={idx}>
                    <TableCell>{line.product_name}</TableCell>
                    <TableCell>{line.size_name}</TableCell>
                    <TableCell>{modifiersText}</TableCell>
                    <TableCell align="right">{line.qty}</TableCell>
                    <TableCell align="right">{formatNumber(line.net_line_total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Phone stacked cards (hidden on desktop) */}
        <div className="p-4 space-y-3 lg:hidden" data-testid="phone-lines-list">
          {order.lines.map((line, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-border bg-surface-card flex items-center justify-between gap-3 min-h-[44px]"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary truncate">
                  <span className="text-primary mr-1">{line.qty}x</span>
                  {line.product_name}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Size {line.size_name}
                  {line.modifiers && line.modifiers.length > 0 && (
                    <span className="text-text-secondary">
                      {" · "}
                      {line.modifiers
                        .map((m: any) => `${Number(m.qty || 1) > 1 ? `${m.qty}x ` : ""}${m.name}`)
                        .join(", ")}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right font-medium text-text-primary whitespace-nowrap tabular-nums">
                {formatNumber(line.net_line_total)}
              </div>
            </div>
          ))}
        </div>

        {/* Total: Khách trả */}
        <div className="p-4 border-t border-border flex justify-between items-center text-base font-semibold bg-surface-secondary/20">
          <span className="text-text-primary">Khách trả</span>
          <span className="text-primary tabular-nums">{formatNumber(order.net_total)}</span>
        </div>
      </div>

      {/* Right column: required reason box, Confirm and Back buttons */}
      <div className="bg-surface-card rounded-xl shadow-sm border border-border p-5 space-y-4">
        {errorMessage && (
          <Alert variant="danger">
            {errorMessage}
          </Alert>
        )}

        <Field label="Lý do huỷ" htmlFor="cancel-reason" required>
            <textarea
              id="cancel-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: khách đổi ý hoặc nhập trùng"
              className="w-full border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card text-text-primary resize-y min-h-[100px]"
            />
        </Field>

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
    </form>
  );
}
