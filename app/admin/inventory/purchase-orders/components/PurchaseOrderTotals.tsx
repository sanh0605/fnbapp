"use client";

import { NumberInput } from "@/components/ui/NumberInput";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { formatNumber } from "@/lib/shared/format";
import type { DBBankAccount } from "@/types/db";

export interface PurchaseOrderTotalsProps {
  formId: string;
  subtotalAmount: number;
  totalAmount: number;
  shippingFee: number;
  setShippingFee: (fee: number) => void;
  taxAmount: number;
  setTaxAmount: (tax: number) => void;
  voucherAmount: number;
  setVoucherAmount: (voucher: number) => void;
  discountAmount: number;
  setDiscountAmount: (discount: number) => void;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "";
  setPaymentMethod: (method: "CASH" | "BANK_TRANSFER" | "") => void;
  bankAccountId: string;
  setBankAccountId: (id: string) => void;
  bankAccounts: DBBankAccount[];
  paymentError: string | null;
  setPaymentError: (err: string | null) => void;
  showExtra?: boolean;
  setShowExtra?: (show: boolean | ((prev: boolean) => boolean)) => void;
}

export function PurchaseOrderTotals({
  formId,
  subtotalAmount,
  totalAmount,
  shippingFee,
  setShippingFee,
  taxAmount,
  setTaxAmount,
  voucherAmount,
  setVoucherAmount,
  discountAmount,
  setDiscountAmount,
  paymentMethod,
  setPaymentMethod,
  bankAccountId,
  setBankAccountId,
  bankAccounts,
  paymentError,
  setPaymentError,
  showExtra = false,
  setShowExtra,
}: PurchaseOrderTotalsProps) {
  return (
    <>
      <h3 className="text-sm text-text-secondary mb-3">Thanh toán</h3>
      <div className="w-full mb-6 space-y-3 bg-surface-card rounded-xl shadow-sm border border-border p-5">
        <div className="flex justify-between items-center text-sm text-text-secondary">
          <span className="font-medium">Tổng tiền hàng:</span>
          <span className="font-semibold text-text-primary">{formatNumber(subtotalAmount)}</span>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/60">
          <div className="flex justify-between items-center text-sm gap-2">
            <span className="text-text-secondary">Phí vận chuyển (+):</span>
            <div className="w-28 md:w-32">
              <NumberInput
                id={`${formId}-shipping`}
                aria-label="Phí vận chuyển"
                decimals={0}
                zeroIsEmpty
                value={shippingFee || null}
                onValueChange={(v) => setShippingFee(v ?? 0)}
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-sm gap-2">
            <span className="text-text-secondary">Voucher (-):</span>
            <div className="w-28 md:w-32">
              <NumberInput
                id={`${formId}-voucher`}
                aria-label="Voucher"
                decimals={0}
                zeroIsEmpty
                value={voucherAmount || null}
                onValueChange={(v) => setVoucherAmount(v ?? 0)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowExtra?.((prev: boolean) => !prev)}
            className="text-sm text-primary hover:underline py-1 flex items-center justify-between w-full"
          >
            <span>Thuế, chiết khấu, ghi chú</span>
            <span className="text-xs text-text-muted">{showExtra ? "▲" : "▼"}</span>
          </button>

          <div className={showExtra ? "space-y-2" : "hidden"} style={showExtra ? undefined : { display: "none" }}>
            <div className="flex justify-between items-center text-sm gap-2">
              <span className="text-text-secondary">Thuế (+):</span>
              <div className="w-28 md:w-32">
                <NumberInput
                  id={`${formId}-tax`}
                  aria-label="Thuế"
                  decimals={0}
                  zeroIsEmpty
                  value={taxAmount || null}
                  onValueChange={(v) => setTaxAmount(v ?? 0)}
                />
              </div>
            </div>
            <div className="flex justify-between items-center text-sm gap-2">
              <span className="text-text-secondary">Chiết khấu (-):</span>
              <div className="w-28 md:w-32">
                <NumberInput
                  id={`${formId}-discount`}
                  aria-label="Chiết khấu"
                  decimals={0}
                  zeroIsEmpty
                  value={discountAmount || null}
                  onValueChange={(v) => setDiscountAmount(v ?? 0)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border">
          <span className="text-base font-bold text-text-primary">Cần thanh toán:</span>
          <span className="text-2xl font-bold text-success">{formatNumber(totalAmount)}</span>
        </div>
      </div>

      <div className="w-full mb-6">
        <span className="block text-sm font-semibold text-text-secondary mb-2">
          Hình thức thanh toán
        </span>
        <div className="flex items-center gap-6 min-h-[48px] md:min-h-[40px]">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary">
            <input
              type="radio"
              name="payment_method_radio"
              value="CASH"
              checked={paymentMethod === "CASH"}
              onChange={() => {
                setPaymentMethod("CASH");
                setBankAccountId("");
                setPaymentError(null);
              }}
              className="w-4 h-4 text-primary focus:ring-focus-ring"
            />
            <span>Tiền mặt</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary">
            <input
              type="radio"
              name="payment_method_radio"
              value="BANK_TRANSFER"
              checked={paymentMethod === "BANK_TRANSFER"}
              onChange={() => {
                setPaymentMethod("BANK_TRANSFER");
                setPaymentError(null);
                if (!bankAccountId && bankAccounts.length === 1) {
                  setBankAccountId(bankAccounts[0].id);
                }
              }}
              className="w-4 h-4 text-primary focus:ring-focus-ring"
            />
            <span>Chuyển khoản</span>
          </label>
        </div>

        {paymentMethod === "BANK_TRANSFER" && (
          <div className="mt-3">
            <Field label="Tài khoản" htmlFor={`${formId}-bankAccountId`}>
              <Select
                id={`${formId}-bankAccountId`}
                value={bankAccountId}
                onChange={(e) => {
                  setBankAccountId(e.target.value);
                  setPaymentError(null);
                }}
              >
                <option value="">-- Chọn tài khoản --</option>
                {bankAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                {bankAccountId && !bankAccounts.some((a: any) => a.id === bankAccountId) && (
                  <option value={bankAccountId}>{bankAccountId} (không còn dùng)</option>
                )}
              </Select>
            </Field>
          </div>
        )}

        {paymentError && (
          <div role="alert" className="text-sm font-medium text-danger mt-2">
            {paymentError}
          </div>
        )}
      </div>
    </>
  );
}

export default PurchaseOrderTotals;
