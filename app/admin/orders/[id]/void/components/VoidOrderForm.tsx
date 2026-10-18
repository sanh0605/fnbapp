"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
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
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
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
                    : "—";

                return (
                  <TableRow key={idx}>
                    <TableCell>{line.product_name}</TableCell>
                    <TableCell>{line.size_name}</TableCell>
                    <TableCell>{modifiersText}</TableCell>
                    <TableCell align="right">{line.qty}</TableCell>
                    <TableCell align="right">{formatNumber(line.net_line_total)}đ</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Phone stacked lines (hidden on desktop) */}
        <div
          className="bg-surface-card rounded-xl shadow-sm border border-border overflow-hidden divide-y divide-border lg:hidden"
          data-testid="phone-lines-list"
        >
          {order.lines.map((line, idx) => {
            const gross = line.gross_line_total;
            const net = line.net_line_total;
            const qtySize = line.size_name ? `${line.qty} × Size ${line.size_name}` : `${line.qty}`;
            const modifiersText =
              line.modifiers && line.modifiers.length > 0
                ? `+ ${line.modifiers.map((m: any) => `${Number(m.qty || 1) > 1 ? `${m.qty}x ` : ""}${m.name}`).join(", ")}`
                : null;
            const meta = [qtySize, modifiersText].filter(Boolean).join(" · ");

            return (
              <div key={idx} className="px-4 py-2.5">
                <PhoneRow
                  title={line.product_name}
                  value={
                    gross > net ? (
                      <span>
                        <span className="text-xs text-text-muted line-through mr-1 font-normal">
                          {formatNumber(gross)}đ
                        </span>
                        <span>{formatNumber(net)}đ</span>
                      </span>
                    ) : (
                      `${formatNumber(net)}đ`
                    )
                  }
                  meta={meta}
                />
              </div>
            );
          })}
        </div>

        {/* Total: Khách trả */}
        <div className="bg-surface-card rounded-xl shadow-sm border border-border p-4 flex justify-between items-center text-base font-semibold">
          <span className="text-text-primary">Khách trả</span>
          <span className="text-primary tabular-nums">{formatNumber(order.net_total)}đ</span>
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
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: khách đổi ý hoặc nhập trùng"
            className="w-full border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card text-text-primary resize-y min-h-[100px]"
          />
          <div className="text-right text-xs text-text-muted">
            {reason.length}/500
          </div>
        </Field>

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
    </form>
  );
}
