"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashTransfer, updateCashTransfer } from "../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { safeReturnTo } from "./return-to";
import type { DBBankAccount, DBCashTransfer } from "@/types/db";

interface CashTransferFormProps {
  transfer?: DBCashTransfer;
  accounts: DBBankAccount[];
  today?: string;
  returnTo?: string;
}

export function CashTransferForm({
  transfer,
  accounts,
  today,
  returnTo: rawReturnTo,
}: CashTransferFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/finance");
  const isEdit = !!transfer;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountOptions = accounts.filter(
    (a) =>
      a.status === "ACTIVE" ||
      a.id === transfer?.from_account_id ||
      a.id === transfer?.to_account_id,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const from = ((formData.get("from") as string) || "").trim();
    const to = ((formData.get("to") as string) || "").trim();

    if (!from) {
      setError("Chọn nơi chuyển");
      return;
    }
    if (!to) {
      setError("Chọn nơi nhận");
      return;
    }
    if (from === to) {
      setError("Nơi chuyển và nơi nhận phải khác nhau");
      return;
    }

    setLoading(true);
    setError(null);

    if (isEdit && transfer) formData.set("id", transfer.id);
    const result = isEdit
      ? await updateCashTransfer(formData)
      : await addCashTransfer(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  const defaultFrom = transfer ? (transfer.from_account_id ?? "CASH") : "";
  const defaultTo = transfer ? (transfer.to_account_id ?? "CASH") : "";

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor={`${formId}-transfer_date`}
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Ngày
          </label>
          <input
            id={`${formId}-transfer_date`}
            type="date"
            name="transfer_date"
            required
            defaultValue={transfer?.transfer_date ?? today}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
          />
        </div>

        <div>
          <label
            htmlFor={`${formId}-amount`}
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Số tiền (đồng)
          </label>
          <MoneyInput
            id={`${formId}-amount`}
            name="amount"
            required
            defaultValue={transfer?.amount}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: 500,000"
          />
        </div>

        <div>
          <label
            htmlFor={`${formId}-from`}
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Từ
          </label>
          <select
            id={`${formId}-from`}
            name="from"
            required
            defaultValue={defaultFrom}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          >
            <option value="" disabled>
              Chọn nơi chuyển
            </option>
            <option value="CASH">Tiền mặt (két)</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${formId}-to`}
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Đến
          </label>
          <select
            id={`${formId}-to`}
            name="to"
            required
            defaultValue={defaultTo}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          >
            <option value="" disabled>
              Chọn nơi nhận
            </option>
            <option value="CASH">Tiền mặt (két)</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${formId}-note`}
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Ghi chú
          </label>
          <input
            id={`${formId}-note`}
            type="text"
            name="note"
            defaultValue={transfer?.note ?? ""}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="Không bắt buộc"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition text-center"
          >
            Bỏ
          </button>
          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang lưu…"
            className="w-full sm:w-auto"
          >
            {isEdit ? "Cập nhật" : "Lưu"}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
