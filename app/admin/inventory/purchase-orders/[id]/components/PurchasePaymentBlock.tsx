"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPurchaseOrderPayment } from "../../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBBankAccount } from "@/types/db";

export interface PurchasePaymentBlockProps {
  poId: string;
  paymentMethod?: "CASH" | "BANK_TRANSFER" | null;
  bankAccountId?: string | null;
  bankAccounts: DBBankAccount[];
  canEdit: boolean;
}

export function PurchasePaymentBlock({
  poId,
  paymentMethod,
  bankAccountId,
  bankAccounts,
  canEdit,
}: PurchasePaymentBlockProps) {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<"CASH" | "BANK_TRANSFER" | "">(
    paymentMethod ?? ""
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    bankAccountId ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentLabel =
    paymentMethod === "CASH"
      ? "Tiền mặt"
      : paymentMethod === "BANK_TRANSFER"
      ? "Chuyển khoản"
      : "—";

  const currentAccount = bankAccounts.find((a) => a.id === bankAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    const formData = new FormData();
    formData.append("id", poId);
    formData.append("payment_method", selectedMethod);
    formData.append("bank_account_id", selectedMethod === "BANK_TRANSFER" ? selectedAccountId : "");

    const res = await setPurchaseOrderPayment(formData);
    setLoading(false);

    if (res.success) {
      setSavedSuccess(true);
      router.refresh();
    } else {
      setError(res.error || "Có lỗi xảy ra");
    }
  };

  return (
    <div className="pt-3 border-t border-border space-y-3">
      <div className="flex justify-between text-sm text-text-secondary">
        <span>Hình thức thanh toán:</span>
        <span className="font-medium text-text-primary">
          {currentLabel}
          {paymentMethod === "BANK_TRANSFER" && currentAccount ? ` (${currentAccount.name})` : ""}
        </span>
      </div>

      {canEdit && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-border/60">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Đổi cách trả tiền
          </div>

          <div className="flex items-center gap-6 min-h-[44px]">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary">
              <input
                type="radio"
                name={`po-payment-${poId}`}
                value="CASH"
                checked={selectedMethod === "CASH"}
                onChange={() => {
                  setSelectedMethod("CASH");
                  setSelectedAccountId("");
                  setError(null);
                  setSavedSuccess(false);
                }}
                className="w-4 h-4 text-primary focus:ring-focus-ring"
              />
              <span>Tiền mặt</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary">
              <input
                type="radio"
                name={`po-payment-${poId}`}
                value="BANK_TRANSFER"
                checked={selectedMethod === "BANK_TRANSFER"}
                onChange={() => {
                  setSelectedMethod("BANK_TRANSFER");
                  setError(null);
                  setSavedSuccess(false);
                  if (!selectedAccountId && bankAccounts.length === 1) {
                    setSelectedAccountId(bankAccounts[0].id);
                  }
                }}
                className="w-4 h-4 text-primary focus:ring-focus-ring"
              />
              <span>Chuyển khoản</span>
            </label>
          </div>

          {selectedMethod === "BANK_TRANSFER" && (
            <div>
              <label htmlFor={`po-payment-account-${poId}`} className="block text-xs font-semibold text-text-secondary mb-1">
                Tài khoản *
              </label>
              <select
                id={`po-payment-account-${poId}`}
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setError(null);
                  setSavedSuccess(false);
                }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
              >
                <option value="">-- Chọn tài khoản --</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                {selectedAccountId && !bankAccounts.some((a) => a.id === selectedAccountId) && (
                  <option value={selectedAccountId}>{selectedAccountId} (không còn dùng)</option>
                )}
              </select>
            </div>
          )}

          {error && (
            <div role="alert" className="text-sm font-medium text-danger">
              {error}
            </div>
          )}

          {savedSuccess && (
            <div className="text-sm font-medium text-success">
              Đã cập nhật cách trả tiền
            </div>
          )}

          <div className="flex justify-end pt-1">
            <LoadingButton
              type="submit"
              loading={loading}
              variant="primary"
              className="px-4 py-2 text-sm font-medium min-h-[44px]"
            >
              Lưu
            </LoadingButton>
          </div>
        </form>
      )}
    </div>
  );
}

export default PurchasePaymentBlock;
