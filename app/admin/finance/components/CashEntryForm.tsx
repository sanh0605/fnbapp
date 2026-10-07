"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashEntry, updateCashEntry } from "../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { safeReturnTo } from "./return-to";
import type { DBBankAccount, DBCashCategory, DBCashEntry } from "@/types/db";

interface CashEntryFormProps {
  // Present -> edit this entry. Absent -> add a new one.
  entry?: DBCashEntry;
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
  // M7: today in Asia/Saigon, the same value the page already computes for
  // DateRangeFilter -- only used to default the add form's date. The edit
  // form always keeps the entry's own date.
  today?: string;
  returnTo?: string;
}

export function CashEntryForm({
  entry,
  categories,
  accounts,
  today,
  returnTo: rawReturnTo,
}: CashEntryFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/finance");
  const isEdit = !!entry;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">(
    entry?.payment_method ?? "CASH",
  );

  // ACTIVE rows to pick from, plus this entry's own group/account even if it
  // has since been retired -- otherwise opening the edit form and saving
  // would silently drop it.
  const categoryOptions = categories.filter(
    (c) => c.status === "ACTIVE" || c.id === entry?.category_id,
  );
  const accountOptions = accounts.filter(
    (a) => a.status === "ACTIVE" || a.id === entry?.bank_account_id,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);

    if (isEdit && entry) formData.set("id", entry.id);
    const result = isEdit ? await updateCashEntry(formData) : await addCashEntry(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}

        <div>
          <label htmlFor={`${formId}-entry_date`} className="block text-sm font-medium text-text-secondary mb-1">
            Ngày
          </label>
          <input
            id={`${formId}-entry_date`}
            type="date"
            name="entry_date"
            required
            defaultValue={entry?.entry_date ?? today}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-category_id`} className="block text-sm font-medium text-text-secondary mb-1">
            Nhóm thu chi
          </label>
          <select
            id={`${formId}-category_id`}
            name="category_id"
            required
            defaultValue={entry?.category_id ?? ""}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          >
            <option value="" disabled>Chọn nhóm</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${formId}-amount`} className="block text-sm font-medium text-text-secondary mb-1">
            Số tiền (đồng)
          </label>
          <MoneyInput
            id={`${formId}-amount`}
            // BR-CASH-005: digits-only box that groups thousands itself
            // as the owner types -- see components/ui/MoneyInput.tsx.
            name="amount"
            required
            defaultValue={entry?.amount}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: 150,000"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-payment_method`} className="block text-sm font-medium text-text-secondary mb-1">
            Cách trả
          </label>
          <select
            id={`${formId}-payment_method`}
            name="payment_method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH")}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          >
            <option value="CASH">Tiền mặt</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
          </select>
        </div>

        {/* Cash never needs an account -- the field is not rendered at
            all when it does not apply, not rendered-and-disabled. */}
        {paymentMethod === "BANK_TRANSFER" && (
          <div>
            <label htmlFor={`${formId}-bank_account_id`} className="block text-sm font-medium text-text-secondary mb-1">
              Tài khoản
            </label>
            <select
              id={`${formId}-bank_account_id`}
              name="bank_account_id"
              required
              defaultValue={entry?.bank_account_id ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            >
              <option value="" disabled>Chọn tài khoản</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor={`${formId}-note`} className="block text-sm font-medium text-text-secondary mb-1">
            Ghi chú
          </label>
          <input
            id={`${formId}-note`}
            type="text"
            name="note"
            defaultValue={entry?.note ?? ""}
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
