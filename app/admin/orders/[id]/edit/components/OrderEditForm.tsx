"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/shared/format";
import { changeOrderPayments } from "@/app/admin/orders/order-edit-actions";
import type { OrderListItem } from "@/app/admin/orders/actions";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { Alert } from "@/components/ui/Alert";
import { FormActionBar } from "@/components/ui/FormActionBar";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";

interface PaymentPart {
  method: "CASH" | "BANK_TRANSFER";
  amount: number;
}

function normalizePaymentMethod(method?: string): "CASH" | "BANK_TRANSFER" {
  if (method === "BANK_TRANSFER" || method === "Chuyen khoan") {
    return "BANK_TRANSFER";
  }
  return "CASH";
}

interface OrderEditFormProps {
  order: OrderListItem;
  returnTo: string;
}

export function OrderEditForm({ order, returnTo }: OrderEditFormProps) {
  const router = useRouter();
  const viewUrl = `/admin/orders/${encodeURIComponent(order.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const orderNo = order.display_order_no || order.order_no;

  const totalAmount = Number(order.net_total || 0);

  const [payments, setPayments] = useState<PaymentPart[]>(() => {
    if (Array.isArray(order.payments) && order.payments.length > 0) {
      return order.payments.map((p) => ({
        method: normalizePaymentMethod(p.method),
        amount: Number(p.amount) || 0,
      }));
    }
    const fallbackMethod = normalizePaymentMethod(order.method);
    return [
      {
        method: fallbackMethod,
        amount: totalAmount,
      },
    ];
  });

  const [editReason, setEditReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const totalParts = payments.reduce((sum, p) => sum + p.amount, 0);

  const isPaymentValid =
    payments.length === 1
      ? true
      : payments.length === 2 &&
        payments.every((p) => p.amount > 0) &&
        payments[0].method !== payments[1].method &&
        totalParts === totalAmount;

  const handleMethodChange = (idx: number, newMethod: "CASH" | "BANK_TRANSFER") => {
    setPayments((prev) =>
      prev.map((p, i) => {
        if (i === idx) return { ...p, method: newMethod };
        if (prev.length === 2 && p.method === newMethod) {
          return { ...p, method: newMethod === "CASH" ? "BANK_TRANSFER" : "CASH" };
        }
        return p;
      })
    );
  };

  const handleAmountChange = (idx: number, amount: number) => {
    setPayments((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, amount } : p))
    );
  };

  const handleAddPaymentPart = () => {
    if (payments.length !== 1) return;
    const currentMethod = payments[0].method;
    const otherMethod: "CASH" | "BANK_TRANSFER" =
      currentMethod === "CASH" ? "BANK_TRANSFER" : "CASH";
    setPayments([
      { method: currentMethod, amount: totalAmount },
      { method: otherMethod, amount: 0 },
    ]);
  };

  const handleRemovePaymentPart = (removeIdx: number) => {
    if (payments.length <= 1) return;
    setPayments((prev) => prev.filter((_, i) => i !== removeIdx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) {
      return;
    }
    setInlineError(null);
    setIsSaving(true);

    const payloadPayments: { method: "CASH" | "BANK_TRANSFER"; amount: number }[] =
      payments.length === 1
        ? [{ method: payments[0].method, amount: totalAmount }]
        : payments.map((p) => ({ method: p.method, amount: p.amount }));

    const res = await changeOrderPayments({
      orderId: order.id,
      expectedVersion: order.version,
      payments: payloadPayments,
      reason: editReason.trim(),
    });

    setIsSaving(false);

    if (res.success) {
      const dest = returnTo
        ? `/admin/orders/${encodeURIComponent(res.new_order_id)}?returnTo=${encodeURIComponent(returnTo)}`
        : `/admin/orders/${encodeURIComponent(res.new_order_id)}`;
      router.push(dest);
      router.refresh();
    } else {
      setInlineError(res.error);
    }
  };

  return (
    <DetailFrame>
      <DetailHeader
        backHref={viewUrl}
        backLabel={orderNo}
        title="Đổi cách trả"
        subtitle={orderNo}
      />

      <form onSubmit={handleSave}>
        <div
          data-testid="form-layout"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start mb-6"
        >
        {/* Summary of order as sold (Desktop: left 2/3, Phone: stacked above) */}
        <div
          data-testid="form-lines"
          className="bg-surface-card rounded-card shadow-sm border border-border p-5 space-y-4 lg:col-span-2 lg:col-start-1"
        >
          <div className="font-bold text-text-primary text-base">
            Món trong đơn
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHead>
                <TableHeaderCell>Món</TableHeaderCell>
                <TableHeaderCell>Size</TableHeaderCell>
                <TableHeaderCell>Topping</TableHeaderCell>
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
                    <TableRow key={line.id || idx}>
                      <TableCell>{line.product_name}</TableCell>
                      <TableCell>{line.size_name || "—"}</TableCell>
                      <TableCell>{modifiersText}</TableCell>
                      <TableCell align="right">{line.qty}</TableCell>
                      <TableCell align="right">
                        {line.gross_line_total > line.net_line_total && (
                          <div className="text-xs text-text-muted line-through">
                            {formatNumber(line.gross_line_total)}
                          </div>
                        )}
                        <div>{formatNumber(line.net_line_total)}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Phone cards */}
          <div data-testid="summary-lines-phone" className="md:hidden space-y-3">
            {order.lines.map((line, idx) => {
              const modifiersText =
                line.modifiers && line.modifiers.length > 0
                  ? line.modifiers
                      .map((m: any) => `${Number(m.qty || 1) > 1 ? `${m.qty}x ` : ""}${m.name}`)
                      .join(", ")
                  : "";

              return (
                <div key={line.id || idx} className="bg-page rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-text-primary">
                        <span className="text-primary mr-1">{line.qty}x</span>
                        {line.product_name}
                      </div>
                      {line.size_name && (
                        <div className="text-xs text-text-secondary mt-0.5">Size {line.size_name}</div>
                      )}
                      {modifiersText && (
                        <div className="text-xs text-primary mt-1">+ {modifiersText}</div>
                      )}
                    </div>
                    <div className="text-right">
                      {line.gross_line_total > line.net_line_total && (
                        <div className="text-xs text-text-muted line-through">
                          {formatNumber(line.gross_line_total)}
                        </div>
                      )}
                      <div className="font-bold text-text-primary">{formatNumber(line.net_line_total)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order total */}
          <div className="pt-3 border-t border-border flex justify-between items-center">
            <span className="font-bold text-text-primary">Khách trả</span>
            <span className="text-xl font-black text-primary">{formatNumber(totalAmount)}</span>
          </div>
        </div>

        {/* Form: payment-part editor, reason box, inline alert, buttons */}
        <div
          data-testid="form-money"
          className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden lg:col-start-3 lg:sticky lg:top-4"
        >
          <div className="px-4 py-3 bg-page space-y-3">
            {/* Payment Section (BR-SALE-013) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text-secondary">Thanh toán</span>
                {payments.length === 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddPaymentPart}
                    className="text-xs min-h-[48px] md:min-h-[36px] py-1 px-3"
                  >
                    Thêm cách trả
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {payments.map((part, idx) => (
                  <div
                    key={`payment-part-${idx}`}
                    className="flex flex-col gap-2"
                  >
                    <div className="w-full">
                      <Select
                        aria-label={
                          payments.length === 2
                            ? `Phương thức thanh toán ${idx + 1}`
                            : "Phương thức thanh toán"
                        }
                        value={part.method}
                        onChange={(e) =>
                          handleMethodChange(idx, e.target.value as "CASH" | "BANK_TRANSFER")
                        }
                      >
                        <option
                          value="CASH"
                          disabled={payments.length === 2 && payments[1 - idx]?.method === "CASH"}
                        >
                          Tiền mặt
                        </option>
                        <option
                          value="BANK_TRANSFER"
                          disabled={
                            payments.length === 2 && payments[1 - idx]?.method === "BANK_TRANSFER"
                          }
                        >
                          Chuyển khoản
                        </option>
                      </Select>
                    </div>

                    {payments.length === 2 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <NumberInput
                            id={`payment-amount-${idx}`}
                            decimals={0}
                            unit="đ"
                            min={0}
                            value={part.amount}
                            onValueChange={(v) => handleAmountChange(idx, v ?? 0)}
                            aria-label={`Số tiền ${
                              part.method === "CASH" ? "tiền mặt" : "chuyển khoản"
                            }`}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleRemovePaymentPart(idx)}
                          aria-label={`Xoá ${
                            part.method === "CASH" ? "tiền mặt" : "chuyển khoản"
                          }`}
                          className="px-3 min-h-[48px] md:min-h-[40px] shrink-0"
                        >
                          Xoá
                        </Button>
                      </div>
                    ) : (
                      <div className="w-full text-sm font-semibold text-text-primary text-right tabular-nums py-2 px-1 shrink-0">
                        {formatNumber(totalAmount)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {payments.length === 2 && (
                <div className="space-y-1 pt-1">
                  <div className="text-xs text-text-secondary">
                    Tổng các phần: {formatNumber(totalParts)} • Tiền đơn: {formatNumber(totalAmount)}
                  </div>
                  {totalParts !== totalAmount && (
                    <div role="alert" className="text-xs font-semibold text-danger">
                      Còn lệch {formatNumber(Math.abs(totalParts - totalAmount))}
                    </div>
                  )}
                  {totalParts === totalAmount && payments.some((p) => p.amount <= 0) && (
                    <div role="alert" className="text-xs font-semibold text-danger">
                      Số tiền mỗi phần phải lớn hơn 0
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 bg-page border-t border-border">
            <label htmlFor="edit-order-reason" className="block text-xs font-bold text-text-secondary mb-1.5">
              Lý do chỉnh sửa (bắt buộc)
            </label>
            <textarea
              id="edit-order-reason"
              aria-label="Lý do chỉnh sửa"
              placeholder="Ví dụ: Khách đổi sang chuyển khoản"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              rows={2}
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          {inlineError && (
            <div className="px-4 py-3">
              <Alert variant="danger">
                {inlineError}
              </Alert>
            </div>
          )}
        </div>
      </div>

      <FormActionBar
        mode="edit"
        loading={isSaving}
        disabled={!editReason.trim() || !isPaymentValid}
        onCancel={() => router.push(viewUrl)}
      />
    </form>
  </DetailFrame>
  );
}
